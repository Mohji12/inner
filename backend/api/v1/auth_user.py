from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Response, status

from api.deps import DbSession, CurrentUser
from core.config import settings
from core.limiter import limiter
from core.security import (
    create_access_token, 
    create_2fa_temp_token,
    decode_access_token,
    hash_password, 
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
    VerifyEmailRequest
)
from schemas.user import UserLogin, UserOut, UserRegister, UserRegisterResponse
from services.otp_service import create_and_send_otp, verify_otp
from services.token_service import revoke_refresh_token, rotate_refresh_token, store_refresh_token
from services.two_factor_service import two_factor_service
from services.social_auth_service import social_auth_service

router = APIRouter(prefix="/auth/user", tags=["auth-user"])


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


@router.post("/register", response_model=UserRegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_user(request: Request, db: DbSession, payload: UserRegister) -> UserRegisterResponse:
    email = str(payload.email).lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    if db.query(User).filter(User.phone_number == payload.phone_number).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone number already registered")
    
    password_error = validate_password_strength(payload.password)
    if password_error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, password_error)
    now = datetime.now(timezone.utc)
    user = User(
        id=new_uuid(),
        full_name=payload.full_name,
        email=email,
        phone_number=payload.phone_number,
        password_hash=hash_password(payload.password),
        profile_image=None,
        gender=None,
        date_of_birth=None,
        location=None,
        country_code=None,
        timezone="UTC",
        preferred_language=payload.preferred_language,
        interests=None,
        goals=None,
        preferred_categories=None,
        preferred_communication_mode=None,
        last_login=None,
        account_status="active",
        email_verified=False,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()
    try:
        code = create_and_send_otp(db, email=email, role="user", subject_id=user.id, otp_id=new_uuid())
    except Exception:
        db.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not send verification email. Please try again later.",
        )
    db.commit()
    db.refresh(user)
    base = UserOut.model_validate(user)
    return UserRegisterResponse(
        **base.model_dump(),
        dev_verification_code=None if _smtp_configured() else code,
    )


@router.post("/verify-email", response_model=MessageResponse)
def verify_user_email(db: DbSession, payload: VerifyEmailRequest) -> MessageResponse:
    email = str(payload.email).lower()
    subject_id = verify_otp(db, email=email, role="user", code=payload.code)
    if not subject_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired verification code")
    user = db.query(User).filter(User.id == subject_id, User.email == email).first()
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid verification")
    user.email_verified = True
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    return MessageResponse(message="Email verified. You can sign in now.")


@router.post("/resend-verify-email", response_model=MessageResponse)
def resend_user_verify_email(db: DbSession, payload: ResendVerifyEmailRequest) -> MessageResponse:
    email = str(payload.email).lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or user.email_verified:
        return MessageResponse(message="If an account exists, a verification code was sent.")
    try:
        create_and_send_otp(db, email=email, role="user", subject_id=user.id, otp_id=new_uuid())
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
    
    uri = two_factor_service.get_provisioning_uri(user.email, user.totp_secret)
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
        db.commit()
        raw_refresh = store_refresh_token(db, subject_id=user.id, role="user")
        _set_refresh_cookie(response, raw_refresh)
        access = create_access_token(user.id, "user")
        return LoginResponse(
            access_token=access,
            expires_in=settings.access_token_expire_minutes * 60,
            two_factor_required=True
        )
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid 2FA code")


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
            timezone="UTC",
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
        # Link Google ID if not already linked
        if not user.google_id:
            user.google_id = google_id
        user.email_verified = True # Google verifies emails
    
    user.last_login = now
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
