from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Response, status

from api.deps import DbSession, CurrentUser
from core.config import settings
from core.limiter import limiter
from core.security import (
    create_access_token, 
    create_2fa_temp_token,
    decode_access_token,
    new_uuid, 
    verify_password, 
    validate_password_strength
)
from models.user import User
from schemas.auth import (
    AccessTokenResponse, 
    LoginResponse,
    MessageResponse, 
    ResendVerifyEmailRequest, 
    SocialLoginRequest,
    TwoFactorLoginRequest,
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
    TwoFactorDisableRequest,
    VerifyEmailRequest
)
from schemas.user import UserLogin, UserRegister, UserRegisterResponse
from services.otp_service import create_and_send_otp, verify_otp
from services.token_service import revoke_refresh_token, rotate_refresh_token, store_refresh_token
from services.two_factor_service import two_factor_service
from services.social_auth_service import social_auth_service
from services.meta_capi_service import track_user_lead, track_user_registration_verified
from services.welcome_promo_service import get_welcome_promo_row, send_user_welcome_promo_email
from services.timezone_service import apply_client_timezone, resolve_account_timezone
from pydantic import BaseModel

router = APIRouter(prefix="/auth/user", tags=["auth-user"])


class UserMetaLeadIn(BaseModel):
    user_id: str


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        key=settings.user_refresh_cookie,
        value=raw,
        max_age=settings.refresh_token_expire_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.user_refresh_cookie,
        path="/",
        domain=settings.cookie_domain,
        samesite=settings.cookie_samesite,
    )


def _smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from_email)


def _expose_dev_otp() -> bool:
    """Return OTP in API responses only when SMTP is not configured (local fallback)."""
    return not _smtp_configured()


@router.post("/register", response_model=UserRegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_user(request: Request, db: DbSession, payload: UserRegister) -> UserRegisterResponse:
    """Start signup: store pending details and email OTP. User row is created only after verify."""
    from services.pending_user_registration_service import upsert_pending_user_registration

    email = str(payload.email).lower()
    password_error = validate_password_strength(payload.password)
    if password_error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, password_error)

    try:
        pending = upsert_pending_user_registration(
            db,
            full_name=payload.full_name,
            email=email,
            phone_number=payload.phone_number,
            password=payload.password,
            preferred_language=payload.preferred_language,
            timezone_name=payload.timezone,
        )
    except ValueError as e:
        code = str(e)
        if code == "email_taken":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered") from e
        if code == "phone_taken":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone number already registered") from e
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not start registration") from e

    try:
        code = create_and_send_otp(
            db, email=email, role="user", subject_id=pending.id, otp_id=new_uuid()
        )
    except Exception:
        db.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not send verification email. Please try again later.",
        )
    db.commit()
    db.refresh(pending)

    # Shape matches the old UserOut so the SPA verify step keeps working.
    # email_verified stays false until OTP succeeds and the users row is created.
    return UserRegisterResponse(
        id=pending.id,
        full_name=pending.full_name,
        email=pending.email,
        phone_number=pending.phone_number,
        profile_image=None,
        gender=None,
        date_of_birth=None,
        location=None,
        country_code=None,
        timezone=pending.timezone,
        preferred_language=pending.preferred_language,
        interests=None,
        goals=None,
        preferred_categories=None,
        preferred_communication_mode=None,
        last_login=None,
        account_status="pending_verification",
        email_verified=False,
        is_totp_enabled=False,
        created_at=pending.created_at,
        updated_at=pending.updated_at,
        dev_verification_code=code if _expose_dev_otp() else None,
    )


@router.post("/verify-email", response_model=MessageResponse)
def verify_user_email(db: DbSession, payload: VerifyEmailRequest) -> MessageResponse:
    from services.pending_user_registration_service import (
        create_user_from_pending,
        get_pending_by_email,
    )

    email = str(payload.email).lower()
    subject_id = verify_otp(db, email=email, role="user", code=payload.code)
    if not subject_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired verification code")

    pending = get_pending_by_email(db, email)
    if pending and pending.id == subject_id:
        try:
            user = create_user_from_pending(db, pending)
        except ValueError as e:
            db.rollback()
            code = str(e)
            if code == "pending_expired":
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Registration expired. Please register again.",
                ) from e
            if code in ("email_taken", "phone_taken"):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "This email or phone is already registered. Please sign in.",
                ) from e
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid verification") from e
        db.commit()
        db.refresh(user)
        track_user_registration_verified(
            user_id=user.id,
            email=user.email,
            phone_number=user.phone_number,
        )
        promo = get_welcome_promo_row(db)
        if promo:
            send_user_welcome_promo_email(
                to_email=user.email,
                full_name=user.full_name,
                code=promo.code,
                duration_minutes=promo.allowed_duration_minutes or 5,
                preferred_language=user.preferred_language,
            )
        return MessageResponse(message="Email verified. You can sign in now.")

    # Legacy path: older signups that already created a users row before verify.
    user = db.query(User).filter(User.id == subject_id, User.email == email).first()
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid verification")
    user.email_verified = True
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    track_user_registration_verified(
        user_id=user.id,
        email=user.email,
        phone_number=user.phone_number,
    )
    promo = get_welcome_promo_row(db)
    if promo:
        send_user_welcome_promo_email(
            to_email=user.email,
            full_name=user.full_name,
            code=promo.code,
            duration_minutes=promo.allowed_duration_minutes or 5,
            preferred_language=user.preferred_language,
        )
    return MessageResponse(message="Email verified. You can sign in now.")


@router.post("/meta/lead", status_code=status.HTTP_204_NO_CONTENT)
def user_meta_lead(
    request: Request,
    db: DbSession,
    payload: UserMetaLeadIn,
) -> None:
    """Browser thank-you page calls this to send enriched Meta CAPI Lead (IP, UA, cookies)."""
    user = (
        db.query(User)
        .filter(User.id == payload.user_id.strip(), User.email_verified.is_(True))
        .first()
    )
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Verified user not found")
    track_user_lead(
        user_id=user.id,
        email=user.email,
        phone_number=user.phone_number,
        request=request,
    )


@router.post("/resend-verify-email", response_model=MessageResponse)
def resend_user_verify_email(db: DbSession, payload: ResendVerifyEmailRequest) -> MessageResponse:
    from services.pending_user_registration_service import get_pending_by_email

    email = str(payload.email).lower()
    pending = get_pending_by_email(db, email)
    user = db.query(User).filter(User.email == email).first()

    if user and user.email_verified:
        return MessageResponse(message="If an account exists, a verification code was sent.")

    subject_id: str | None = None
    if pending:
        subject_id = pending.id
    elif user and not user.email_verified:
        subject_id = user.id
    else:
        return MessageResponse(message="If an account exists, a verification code was sent.")

    try:
        create_and_send_otp(db, email=email, role="user", subject_id=subject_id, otp_id=new_uuid())
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not send verification email. Please try again later.",
        )
    return MessageResponse(message="If an account exists, a verification code was sent.")


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def login_user(request: Request, db: DbSession, payload: UserLogin, response: Response) -> LoginResponse:
    email = str(payload.email).lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.email_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Please verify your email before signing in")
    if user.account_status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is not active")

    if user.is_totp_enabled:
        temp_token = create_2fa_temp_token(user.id, "user")
        return LoginResponse(
            access_token="",
            expires_in=0,
            two_factor_required=True,
            temp_token=temp_token
        )

    user.last_login = datetime.now(timezone.utc)
    apply_client_timezone(user, payload.timezone)
    db.commit()
    raw_refresh = store_refresh_token(db, subject_id=user.id, role="user")
    _set_refresh_cookie(response, raw_refresh)
    access = create_access_token(user.id, "user")
    return LoginResponse(
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
        two_factor_required=False
    )


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_user_2fa(db: DbSession, user: CurrentUser) -> TwoFactorSetupResponse:
    if user.is_totp_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "2FA is already enabled")
    
    # Only generate a new secret if they don't have one pending
    if not user.totp_secret:
        user.totp_secret = two_factor_service.generate_secret()
        db.commit()
    
    uri = two_factor_service.get_provisioning_uri(
        user.email, user.totp_secret, issuer_name=settings.two_factor_issuer
    )
    qr_b64 = two_factor_service.generate_qr_code_base64(uri)
    
    return TwoFactorSetupResponse(
        secret=user.totp_secret,
        provisioning_uri=uri,
        qr_code_base64=qr_b64
    )


@router.post("/2fa/verify", response_model=MessageResponse)
def verify_user_2fa_setup(db: DbSession, user: CurrentUser, payload: TwoFactorVerifyRequest) -> MessageResponse:
    if not user.totp_secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "2FA setup not initiated")
    
    if two_factor_service.verify_otp(user.totp_secret, payload.code):
        user.is_totp_enabled = True
        db.commit()
        return MessageResponse(message="Two-factor authentication enabled successfully.")
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid code")


@router.post("/2fa/login", response_model=LoginResponse)
def login_user_2fa(db: DbSession, payload: TwoFactorLoginRequest, response: Response) -> LoginResponse:
    # Verify the temporary 2FA token
    try:
        decoded = decode_access_token(payload.temp_token)
        if decoded.get("type") != "2fa_temp" or decoded.get("role") != "user":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid temporary token")
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid temporary token")
    
    user = db.query(User).filter(User.id == decoded["sub"], User.email == payload.email).first()
    if not user or not user.is_totp_enabled:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication failed")
    
    if two_factor_service.verify_otp(user.totp_secret, payload.code):
        user.last_login = datetime.now(timezone.utc)
        apply_client_timezone(user, payload.timezone)
        db.commit()
        raw_refresh = store_refresh_token(db, subject_id=user.id, role="user")
        _set_refresh_cookie(response, raw_refresh)
        access = create_access_token(user.id, "user")
        return LoginResponse(
            access_token=access,
            expires_in=settings.access_token_expire_minutes * 60,
            two_factor_required=False
        )
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid 2FA code")


@router.post("/2fa/disable", response_model=MessageResponse)
def disable_user_2fa(db: DbSession, user: CurrentUser, payload: TwoFactorDisableRequest) -> MessageResponse:
    if not user.is_totp_enabled or not user.totp_secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "2FA is not enabled")
    if not user.password_hash or user.password_hash == "social_login":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Set a password on your account before disabling 2FA, or contact support.",
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid password")
    if not two_factor_service.verify_otp(user.totp_secret, payload.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid code")
    user.is_totp_enabled = False
    user.totp_secret = None
    db.commit()
    return MessageResponse(message="Two-factor authentication disabled.")


@router.post("/google", response_model=LoginResponse)
def login_user_google(db: DbSession, payload: SocialLoginRequest, response: Response) -> LoginResponse:
    idinfo = social_auth_service.verify_google_token(payload.id_token)
    if not idinfo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token")
    
    google_id = idinfo["sub"]
    email = idinfo["email"].lower()
    
    # Try to find user by Google ID or Email
    user = db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()
    
    now = datetime.now(timezone.utc)
    if not user:
        # Auto-register
        user = User(
            id=new_uuid(),
            full_name=idinfo.get("name", email.split("@")[0]),
            email=email,
            phone_number=f"google_{google_id}", # Placeholder since Google doesn't always provide phone
            country_code=None,
            timezone=resolve_account_timezone(payload.timezone),
            password_hash="social_login", # No password
            google_id=google_id,
            email_verified=True,
            account_status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()
    else:
        if user.google_id and user.google_id != google_id:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This email is linked to a different Google account.",
            )
        has_password_account = bool(user.password_hash and user.password_hash != "social_login")
        if has_password_account and not user.google_id:
            if not payload.link_password or not verify_password(payload.link_password, user.password_hash):
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "An account with this email already exists. Sign in with your password first, or provide your password to link Google.",
                )
            user.google_id = google_id
        elif not user.google_id:
            user.google_id = google_id
        user.email_verified = True
    
    user.last_login = now
    apply_client_timezone(user, payload.timezone)
    db.commit()
    
    # If social user has 2FA enabled, they still need to pass it
    if user.is_totp_enabled:
        temp_token = create_2fa_temp_token(user.id, "user")
        return LoginResponse(
            access_token="",
            expires_in=0,
            two_factor_required=True,
            temp_token=temp_token
        )

    raw_refresh = store_refresh_token(db, subject_id=user.id, role="user")
    _set_refresh_cookie(response, raw_refresh)
    access = create_access_token(user.id, "user")
    return LoginResponse(
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
        two_factor_required=False
    )


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh_user_token(db: DbSession, request: Request, response: Response) -> AccessTokenResponse:
    raw = request.cookies.get(settings.user_refresh_cookie)
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing refresh cookie")
    rotated = rotate_refresh_token(db, raw, "user")
    if not rotated:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    subject_id, new_raw = rotated
    _set_refresh_cookie(response, new_raw)
    user = db.query(User).filter(User.id == subject_id).first()
    if not user or user.account_status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    access = create_access_token(subject_id, "user")
    return AccessTokenResponse(
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_user(db: DbSession, request: Request, response: Response) -> None:
    raw = request.cookies.get(settings.user_refresh_cookie)
    if raw:
        revoke_refresh_token(db, raw, "user")
    _clear_refresh_cookie(response)
