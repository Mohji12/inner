"""Hold user signup details until email OTP or verify-link is verified (no users row until then)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from core.config import settings
from core.security import hash_password, new_uuid
from models.pending_user_registration import PendingUserRegistration
from models.user import User
from services.timezone_service import resolve_account_timezone

# Pending signups survive longer than a single OTP so users can resend the code.
PENDING_REGISTRATION_HOURS = 24


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def hash_verify_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_verify_link_token(pending: PendingUserRegistration) -> str:
    """Attach a fresh one-time verify-link token to pending; returns plaintext token."""
    token = secrets.token_urlsafe(32)
    now = _utcnow()
    pending.verify_token_hash = hash_verify_token(token)
    pending.verify_token_expires_at = now + timedelta(minutes=settings.otp_expire_minutes)
    pending.updated_at = now
    return token


def clear_verify_link_token(pending: PendingUserRegistration) -> None:
    pending.verify_token_hash = None
    pending.verify_token_expires_at = None


def get_pending_by_verify_token(db: Session, token: str) -> PendingUserRegistration | None:
    token = (token or "").strip()
    if not token:
        return None
    digest = hash_verify_token(token)
    pending = (
        db.query(PendingUserRegistration)
        .filter(PendingUserRegistration.verify_token_hash == digest)
        .first()
    )
    if not pending:
        return None
    now = _utcnow()
    if not pending.verify_token_expires_at or _aware(pending.verify_token_expires_at) <= now:
        return None
    if _aware(pending.expires_at) <= now:
        return None
    return pending


def purge_expired_pending_registrations(db: Session) -> int:
    now = _utcnow()
    rows = db.query(PendingUserRegistration).all()
    removed = 0
    for row in rows:
        if _aware(row.expires_at) <= now:
            db.delete(row)
            removed += 1
    return removed


def get_pending_by_email(db: Session, email: str) -> PendingUserRegistration | None:
    return (
        db.query(PendingUserRegistration)
        .filter(PendingUserRegistration.email == email.lower())
        .first()
    )


def upsert_pending_user_registration(
    db: Session,
    *,
    full_name: str,
    email: str,
    phone_number: str,
    password: str,
    preferred_language: str,
    timezone_name: str | None,
) -> PendingUserRegistration:
    """Create or replace a pending signup. Caller must commit after sending OTP."""
    email_l = email.lower()
    now = _utcnow()
    purge_expired_pending_registrations(db)

    existing_user = db.query(User).filter(User.email == email_l).first()
    if existing_user:
        raise ValueError("email_taken")

    phone_user = db.query(User).filter(User.phone_number == phone_number).first()
    if phone_user:
        raise ValueError("phone_taken")

    phone_pending = (
        db.query(PendingUserRegistration)
        .filter(
            PendingUserRegistration.phone_number == phone_number,
            PendingUserRegistration.email != email_l,
        )
        .first()
    )
    if phone_pending and _aware(phone_pending.expires_at) > now:
        raise ValueError("phone_taken")

    pending = get_pending_by_email(db, email_l)
    expires = now + timedelta(hours=PENDING_REGISTRATION_HOURS)
    password_hash = hash_password(password)
    tz = resolve_account_timezone(timezone_name)

    if pending:
        pending.full_name = full_name
        pending.phone_number = phone_number
        pending.password_hash = password_hash
        pending.timezone = tz
        pending.preferred_language = preferred_language or "en"
        pending.expires_at = expires
        pending.updated_at = now
        clear_verify_link_token(pending)
        db.add(pending)
        db.flush()
        return pending

    # Drop stale pending that held this phone under another email.
    if phone_pending:
        db.delete(phone_pending)
        db.flush()

    pending = PendingUserRegistration(
        id=new_uuid(),
        full_name=full_name,
        email=email_l,
        phone_number=phone_number,
        password_hash=password_hash,
        timezone=tz,
        preferred_language=preferred_language or "en",
        expires_at=expires,
        verify_token_hash=None,
        verify_token_expires_at=None,
        created_at=now,
        updated_at=now,
    )
    db.add(pending)
    db.flush()
    return pending


def create_user_from_pending(db: Session, pending: PendingUserRegistration) -> User:
    """Materialize a verified user from pending signup data."""
    now = _utcnow()
    if _aware(pending.expires_at) <= now:
        db.delete(pending)
        raise ValueError("pending_expired")

    if db.query(User).filter(User.email == pending.email).first():
        db.delete(pending)
        raise ValueError("email_taken")
    if db.query(User).filter(User.phone_number == pending.phone_number).first():
        db.delete(pending)
        raise ValueError("phone_taken")

    user = User(
        id=pending.id,
        full_name=pending.full_name,
        email=pending.email,
        phone_number=pending.phone_number,
        password_hash=pending.password_hash,
        profile_image=None,
        gender=None,
        date_of_birth=None,
        location=None,
        country_code=None,
        timezone=pending.timezone or "UTC",
        preferred_language=pending.preferred_language or "en",
        interests=None,
        goals=None,
        preferred_categories=None,
        preferred_communication_mode=None,
        last_login=None,
        account_status="active",
        email_verified=True,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.delete(pending)
    db.flush()
    return user
