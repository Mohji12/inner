import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy.orm import Session

from core.config import settings
from models.email_otp import EmailOtpCode
from services.email_service import send_plain_email

logger = logging.getLogger(__name__)


def _pepper() -> str:
    return settings.otp_pepper or settings.jwt_secret_key


def hash_otp_code(email: str, role: str, code: str) -> str:
    raw = f"{_pepper()}:{email.lower()!s}:{role}:{code}".encode()
    return hashlib.sha256(raw).hexdigest()


def generate_otp_code() -> str:
    return f"{secrets.randbelow(900_000) + 100_000:06d}"


def delete_otp_for_email(db: Session, email: str, role: str) -> None:
    db.query(EmailOtpCode).filter(EmailOtpCode.email == email.lower(), EmailOtpCode.role == role).delete(
        synchronize_session=False
    )


def password_reset_otp_role(account_role: str) -> str:
    return f"password_reset:{account_role}"


def create_and_send_otp(
    db: Session,
    *,
    email: str,
    role: str,
    subject_id: str,
    otp_id: str,
    purpose: Literal["verify", "password_reset"] = "verify",
) -> str:
    """
    Stores OTP hash and sends email. Returns plaintext OTP (for logging when SMTP off).
    """
    email_l = email.lower()
    code = generate_otp_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes)

    delete_otp_for_email(db, email_l, role)
    row = EmailOtpCode(
        id=otp_id,
        email=email_l,
        role=role,
        subject_id=subject_id,
        otp_hash=hash_otp_code(email_l, role, code),
        expires_at=expires,
        attempts=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.flush()

    if purpose == "password_reset":
        subject = f"{settings.app_name} — password reset code"
        body = (
            f"Your password reset code is: {code}\n\n"
            f"It expires in {settings.otp_expire_minutes} minutes.\n"
            f"If you did not request a password reset, you can ignore this email."
        )
    else:
        subject = f"{settings.app_name} — verify your email"
        body = (
            f"Your verification code is: {code}\n\n"
            f"It expires in {settings.otp_expire_minutes} minutes.\n"
            f"If you did not register, you can ignore this email."
        )
    try:
        send_plain_email(to_email=email_l, subject=subject, body=body)
    except Exception as e:
        logger.exception("Failed to send OTP email: %s", e)
        raise
    return code


def create_and_send_password_reset_otp(
    db: Session,
    *,
    email: str,
    role: str,
    subject_id: str,
    otp_id: str,
) -> str:
    return create_and_send_otp(
        db,
        email=email,
        role=password_reset_otp_role(role),
        subject_id=subject_id,
        otp_id=otp_id,
        purpose="password_reset",
    )


def verify_otp(db: Session, *, email: str, role: str, code: str) -> str | None:
    """
    Returns subject_id on success; None on failure (caller should raise HTTPException).
    """
    email_l = email.lower()
    row = (
        db.query(EmailOtpCode)
        .filter(EmailOtpCode.email == email_l, EmailOtpCode.role == role)
        .order_by(EmailOtpCode.created_at.desc())
        .first()
    )
    if not row:
        return None
    now = datetime.now(timezone.utc)
    exp = row.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now > exp:
        return None
    if row.attempts >= settings.otp_max_attempts:
        logger.info("OTP max attempts for %s", email_l)
        return None

    expected = row.otp_hash
    got = hash_otp_code(email_l, role, code.strip())
    if not secrets.compare_digest(expected, got):
        row.attempts += 1
        db.add(row)
        return None

    subject_id = row.subject_id
    db.delete(row)
    return subject_id
