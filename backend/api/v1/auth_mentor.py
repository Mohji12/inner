from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Request, Response, status

from api.deps import DbSession, CurrentMentor
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
from models.mentor import Mentor
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
from schemas.mentor import MentorAccountOut, MentorLogin, MentorRegister, MentorRegisterResponse
from pydantic import BaseModel, EmailStr, Field
from typing import Literal
from services.otp_service import create_and_send_otp, verify_otp
from services.mentor_card_visibility import normalize_card_visibility
from services.onboarding_payment_service import (
    activate_coach_after_email_verification,
    create_onboarding_checkout,
    onboarding_amount_eur,
    onboarding_plans_public,
)
from services.promo_service import PromoError, calculate_discount, validate_promo_code
from services.mollie_service import resolve_mollie_webhook_url
from services.token_service import revoke_refresh_token, rotate_refresh_token, store_refresh_token
from services.two_factor_service import two_factor_service
from services.social_auth_service import social_auth_service
from core.coach_agreement import COACH_AGREEMENT_TEXT, COACH_AGREEMENT_VERSION
from services.i18n_service import to_i18n_map
from services.meta_capi_service import track_mentor_registration_verified

router = APIRouter(prefix="/auth/mentor", tags=["auth-mentor"])


class MentorOnboardingPaymentRequest(BaseModel):
    email: EmailStr
    checkout_currency: str | None = None
    payment_plan: Literal["full", "installments"] = "full"
    installment_number: int = Field(default=1, ge=1, le=2)
    promo_code: str | None = None


class MentorOnboardingPromoValidateIn(BaseModel):
    code: str
    payment_plan: Literal["full", "installments"] = "full"
    installment_number: int = Field(default=1, ge=1, le=2)


class MentorOnboardingPromoValidateOut(BaseModel):
    is_valid: bool
    discount_amount_eur: str
    final_amount_eur: str
    message: str | None = None


class MentorVerifyEmailResponse(BaseModel):
    message: str
    account_active: bool = False
    mentor_id: str


class MentorMetaCompleteRegistrationIn(BaseModel):
    mentor_id: str


class MentorOnboardingPlansOut(BaseModel):
    total_eur: str
    full_eur: str
    installment_eur: str
    installment_count: int
    is_free: bool = False


class MentorOnboardingPaymentResponse(BaseModel):
    payment_id: str
    checkout_url: str
    amount: str
    currency: str
    payment_plan: str
    installment_number: int
    installment_total: int


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        key=settings.mentor_refresh_cookie,
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
        settings.mentor_refresh_cookie,
        path="/",
        domain=settings.cookie_domain,
        samesite=settings.cookie_samesite,
    )


def _smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from_email)


@router.post("/register", response_model=MentorRegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_mentor(request: Request, db: DbSession, payload: MentorRegister) -> MentorRegisterResponse:
    email = str(payload.email).lower()
    if db.query(Mentor).filter(Mentor.email == email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    if db.query(Mentor).filter(Mentor.phone_number == payload.phone_number).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone number already registered")
    
    password_error = validate_password_strength(payload.password)
    if password_error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, password_error)

    if not payload.agreement_accepted:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Coach agreement must be accepted")
    if payload.agreement_version and payload.agreement_version != COACH_AGREEMENT_VERSION:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Coach agreement version mismatch")
    if payload.agreement_text_snapshot and payload.agreement_text_snapshot.strip() != COACH_AGREEMENT_TEXT.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Coach agreement text mismatch")

    now = datetime.now(timezone.utc)
    mentor = Mentor(
        id=new_uuid(),
        full_name=payload.full_name,
        email=email,
        phone_number=payload.phone_number,
        country_code=None,
        timezone="UTC",
        password_hash=hash_password(payload.password),
        profile_image=(
            (payload.profile_image.strip()[:512] or None) if payload.profile_image else None
        ),
        headline=payload.headline,
        headline_i18n=payload.headline_i18n or to_i18n_map(payload.headline),
        bio=payload.bio,
        bio_i18n=payload.bio_i18n or to_i18n_map(payload.bio),
        languages_spoken=payload.languages_spoken,
        years_of_experience=int(payload.years_of_experience or 0),
        current_company=(payload.current_company.strip()[:255] or None) if payload.current_company else None,
        kvk_number=(payload.kvk_number.strip()[:32] or None) if payload.kvk_number else None,
        previous_companies=None,
        education=payload.education,
        certifications=payload.certifications,
        expertise_areas=payload.expertise_areas,
        skills=payload.skills,
        tools_technologies=payload.tools_technologies,
        session_modes=payload.session_modes,
        public_card_visibility=normalize_card_visibility(
            payload.public_card_visibility.model_dump()
            if payload.public_card_visibility is not None and hasattr(payload.public_card_visibility, "model_dump")
            else payload.public_card_visibility
        ),
        average_rating=Decimal("0"),
        total_reviews=0,
        total_sessions_completed=0,
        chat_price_per_minute=Decimal("0.90"),
        chat_currency="EUR",
        chat_min_purchase_minutes=1,
        is_verified=False,
        is_approved=False,
        status="pending",
        email_verified=False,
        agreement_accepted_at=now,
        agreement_version=COACH_AGREEMENT_VERSION,
        agreement_text_snapshot=COACH_AGREEMENT_TEXT,
        agreement_text_snapshot_i18n=to_i18n_map(COACH_AGREEMENT_TEXT),
        created_at=now,
        updated_at=now,
    )
    db.add(mentor)
    db.flush()
    try:
        code = create_and_send_otp(db, email=email, role="mentor", subject_id=mentor.id, otp_id=new_uuid())
    except Exception:
        db.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not send verification email. Please try again later.",
        )
    db.commit()
    db.refresh(mentor)
    base = MentorAccountOut.model_validate(mentor)
    return MentorRegisterResponse(
        **base.model_dump(),
        dev_verification_code=None if _smtp_configured() else code,
    )


@router.post("/verify-email", response_model=MentorVerifyEmailResponse)
def verify_mentor_email(db: DbSession, payload: VerifyEmailRequest) -> MentorVerifyEmailResponse:
    email = str(payload.email).lower()
    subject_id = verify_otp(db, email=email, role="mentor", code=payload.code)
    if not subject_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired verification code")
    mentor = db.query(Mentor).filter(Mentor.id == subject_id, Mentor.email == email).first()
    if not mentor:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid verification")
    mentor.email_verified = True
    mentor.updated_at = datetime.now(timezone.utc)
    activate_coach_after_email_verification(db, mentor=mentor)
    db.commit()
    db.refresh(mentor)
    track_mentor_registration_verified(
        mentor_id=mentor.id,
        email=mentor.email,
        phone_number=mentor.phone_number,
        request=None,
    )
    active = bool(mentor.is_approved and mentor.status == "active")
    return MentorVerifyEmailResponse(
        message=(
            "Email verified. Your coach profile is live on the platform — you can sign in now."
            if active
            else "Email verified. You can sign in now."
        ),
        account_active=active,
        mentor_id=mentor.id,
    )


@router.post("/meta/complete-registration", status_code=status.HTTP_204_NO_CONTENT)
def mentor_meta_complete_registration(
    request: Request,
    db: DbSession,
    payload: MentorMetaCompleteRegistrationIn,
) -> None:
    """Browser thank-you page calls this to send enriched Meta CAPI (IP, UA, cookies)."""
    mentor = (
        db.query(Mentor)
        .filter(Mentor.id == payload.mentor_id.strip(), Mentor.email_verified.is_(True))
        .first()
    )
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Verified coach not found")
    track_mentor_registration_verified(
        mentor_id=mentor.id,
        email=mentor.email,
        phone_number=mentor.phone_number,
        request=request,
    )


@router.post("/resend-verify-email", response_model=MessageResponse)
def resend_mentor_verify_email(db: DbSession, payload: ResendVerifyEmailRequest) -> MessageResponse:
    email = str(payload.email).lower()
    mentor = db.query(Mentor).filter(Mentor.email == email).first()
    if not mentor or mentor.email_verified:
        return MessageResponse(message="If an account exists, a verification code was sent.")
    try:
        create_and_send_otp(db, email=email, role="mentor", subject_id=mentor.id, otp_id=new_uuid())
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not send verification email. Please try again later.",
        )
    return MessageResponse(message="If an account exists, a verification code was sent.")


@router.get("/onboarding-plans", response_model=MentorOnboardingPlansOut)
def get_mentor_onboarding_plans() -> MentorOnboardingPlansOut:
    return MentorOnboardingPlansOut.model_validate(onboarding_plans_public())


@router.post("/onboarding-promo/validate", response_model=MentorOnboardingPromoValidateOut)
def validate_mentor_onboarding_promo(payload: MentorOnboardingPromoValidateIn, db: DbSession) -> MentorOnboardingPromoValidateOut:
    amount_eur = onboarding_amount_eur(
        payment_plan=payload.payment_plan,
        installment_number=payload.installment_number,
    )
    try:
        promo = validate_promo_code(
            db,
            payload.code,
            amount_eur,
            user_id=None,
            mentor_id=None,
            scope="onboarding",
        )
        discount = calculate_discount(promo, amount_eur)
        final = max(Decimal("0.00"), amount_eur - discount)
        return MentorOnboardingPromoValidateOut(
            is_valid=True,
            discount_amount_eur=str(discount.quantize(Decimal("0.01"))),
            final_amount_eur=str(final.quantize(Decimal("0.01"))),
        )
    except PromoError as e:
        return MentorOnboardingPromoValidateOut(
            is_valid=False,
            discount_amount_eur="0.00",
            final_amount_eur=str(amount_eur),
            message=str(e),
        )


@router.post("/onboarding-payment", response_model=MentorOnboardingPaymentResponse)
def create_mentor_onboarding_payment(request: Request, db: DbSession, payload: MentorOnboardingPaymentRequest) -> MentorOnboardingPaymentResponse:
    email = str(payload.email).lower()
    mentor = db.query(Mentor).filter(Mentor.email == email).first()
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")

    redirect_url = f"{settings.mollie_redirect_base_url.rstrip('/')}/login?role=mentor"
    webhook_url = resolve_mollie_webhook_url(request)
    row = create_onboarding_checkout(
        db,
        mentor=mentor,
        payment_plan=payload.payment_plan,
        installment_number=payload.installment_number,
        checkout_currency=payload.checkout_currency or "EUR",
        redirect_url=redirect_url,
        webhook_url=webhook_url,
        promo_code=payload.promo_code,
    )
    db.commit()
    return MentorOnboardingPaymentResponse(
        payment_id=row.mollie_payment_id,
        checkout_url=row.checkout_url or "",
        amount=str(row.amount),
        currency=row.currency,
        payment_plan=row.payment_plan,
        installment_number=row.installment_number,
        installment_total=row.installment_total,
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def login_mentor(request: Request, db: DbSession, payload: MentorLogin, response: Response) -> LoginResponse:
    email = str(payload.email).lower()
    mentor = db.query(Mentor).filter(Mentor.email == email).first()
    if not mentor or not verify_password(payload.password, mentor.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not mentor.email_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Please verify your email before signing in")
    if mentor.status == "rejected":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your coach account was rejected. Please contact support.")

    activate_coach_after_email_verification(db, mentor=mentor)

    if mentor.is_totp_enabled:
        temp_token = create_2fa_temp_token(mentor.id, "mentor")
        return LoginResponse(
            access_token="",
            expires_in=0,
            two_factor_required=True,
            temp_token=temp_token
        )

    mentor.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    raw_refresh = store_refresh_token(db, subject_id=mentor.id, role="mentor")
    _set_refresh_cookie(response, raw_refresh)
    access = create_access_token(mentor.id, "mentor")
    return LoginResponse(
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
        two_factor_required=False
    )


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_mentor_2fa(db: DbSession, mentor: CurrentMentor) -> TwoFactorSetupResponse:
    if mentor.is_totp_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "2FA is already enabled")
    
    if not mentor.totp_secret:
        mentor.totp_secret = two_factor_service.generate_secret()
        db.commit()
    
    uri = two_factor_service.get_provisioning_uri(mentor.email, mentor.totp_secret)
    qr_b64 = two_factor_service.generate_qr_code_base64(uri)
    
    return TwoFactorSetupResponse(
        secret=mentor.totp_secret,
        provisioning_uri=uri,
        qr_code_base64=qr_b64
    )


@router.post("/2fa/verify", response_model=MessageResponse)
def verify_mentor_2fa_setup(db: DbSession, mentor: CurrentMentor, payload: TwoFactorVerifyRequest) -> MessageResponse:
    if not mentor.totp_secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "2FA setup not initiated")
    
    if two_factor_service.verify_otp(mentor.totp_secret, payload.code):
        mentor.is_totp_enabled = True
        db.commit()
        return MessageResponse(message="Two-factor authentication enabled successfully.")
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid code")


@router.post("/2fa/login", response_model=LoginResponse)
def login_mentor_2fa(db: DbSession, payload: TwoFactorLoginRequest, response: Response) -> LoginResponse:
    try:
        decoded = decode_access_token(payload.temp_token)
        if decoded.get("type") != "2fa_temp" or decoded.get("role") != "mentor":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid temporary token")
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid temporary token")
    
    mentor = db.query(Mentor).filter(Mentor.id == decoded["sub"], Mentor.email == payload.email).first()
    if not mentor or not mentor.is_totp_enabled:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication failed")
    
    if two_factor_service.verify_otp(mentor.totp_secret, payload.code):
        mentor.last_seen_at = datetime.now(timezone.utc)
        db.commit()
        raw_refresh = store_refresh_token(db, subject_id=mentor.id, role="mentor")
        _set_refresh_cookie(response, raw_refresh)
        access = create_access_token(mentor.id, "mentor")
        return LoginResponse(
            access_token=access,
            expires_in=settings.access_token_expire_minutes * 60,
            two_factor_required=True
        )
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid 2FA code")


@router.post("/google", response_model=LoginResponse)
def login_mentor_google(db: DbSession, payload: SocialLoginRequest, response: Response) -> LoginResponse:
    idinfo = social_auth_service.verify_google_token(payload.id_token)
    if not idinfo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token")
    
    google_id = idinfo["sub"]
    email = idinfo["email"].lower()
    
    # Coaches MUST register explicitly or be invited, we don't auto-register coaches.
    mentor = db.query(Mentor).filter((Mentor.google_id == google_id) | (Mentor.email == email)).first()
    
    if not mentor:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Coach account not found. Please register as a coach first.")
    
    if not mentor.google_id:
        mentor.google_id = google_id
    mentor.email_verified = True
    if mentor.status == "rejected":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your coach account was rejected. Please contact support.")
    
    mentor.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    
    if mentor.is_totp_enabled:
        temp_token = create_2fa_temp_token(mentor.id, "mentor")
        return LoginResponse(
            access_token="",
            expires_in=0,
            two_factor_required=True,
            temp_token=temp_token
        )

    raw_refresh = store_refresh_token(db, subject_id=mentor.id, role="mentor")
    _set_refresh_cookie(response, raw_refresh)
    access = create_access_token(mentor.id, "mentor")
    return LoginResponse(
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
        two_factor_required=False
    )


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh_mentor_token(db: DbSession, request: Request, response: Response) -> AccessTokenResponse:
    raw = request.cookies.get(settings.mentor_refresh_cookie)
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing refresh cookie")
    rotated = rotate_refresh_token(db, raw, "mentor")
    if not rotated:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    subject_id, new_raw = rotated
    _set_refresh_cookie(response, new_raw)
    access = create_access_token(subject_id, "mentor")
    return AccessTokenResponse(
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_mentor(db: DbSession, request: Request, response: Response) -> None:
    raw = request.cookies.get(settings.mentor_refresh_cookie)
    if raw:
        revoke_refresh_token(db, raw, "mentor")
    _clear_refresh_cookie(response)
