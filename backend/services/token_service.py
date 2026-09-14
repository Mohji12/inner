from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from core.config import settings
from core.security import create_raw_refresh_token, hash_refresh_token, new_uuid
from models.refresh_token import RefreshToken


def _aware(dt: datetime) -> datetime:
    """MySQL DATETIME often comes back naive; treat naive values as UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def store_refresh_token(db: Session, *, subject_id: str, role: str) -> str:
    raw = create_raw_refresh_token()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=settings.refresh_token_expire_days)
    row = RefreshToken(
        id=new_uuid(),
        subject_id=subject_id,
        role=role,
        token_hash=hash_refresh_token(raw),
        expires_at=expires,
        revoked_at=None,
        created_at=now,
    )
    db.add(row)
    db.commit()
    return raw


def validate_refresh_token(db: Session, raw: str, role: str) -> str | None:
    """Returns subject_id if valid."""
    h = hash_refresh_token(raw)
    now = datetime.now(timezone.utc)
    row = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == h,
            RefreshToken.role == role,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .first()
    )
    if not row:
        return None
    # Defense in depth: driver may return naive expires_at; re-check in Python.
    if _aware(row.expires_at) <= now:
        return None
    return row.subject_id


def revoke_refresh_token(db: Session, raw: str, role: str) -> None:
    h = hash_refresh_token(raw)
    row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == h, RefreshToken.role == role)
        .first()
    )
    if row and row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
        db.commit()


def revoke_all_refresh_for_subject(db: Session, subject_id: str, role: str) -> None:
    now = datetime.now(timezone.utc)
    for row in (
        db.query(RefreshToken)
        .filter(
            RefreshToken.subject_id == subject_id,
            RefreshToken.role == role,
            RefreshToken.revoked_at.is_(None),
        )
        .all()
    ):
        row.revoked_at = now
    db.commit()


def rotate_refresh_token(db: Session, raw: str, role: str) -> tuple[str, str] | None:
    """Revoke the presented refresh token and issue a new one in a single commit.

    Returns (subject_id, new_raw_token) or None if the token is invalid.

    Allows a short reuse window after revoke so multi-tab wake (laptop open)
    does not log the coach out when two tabs rotate the same cookie.
    """
    h = hash_refresh_token(raw)
    now = datetime.now(timezone.utc)
    row = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == h,
            RefreshToken.role == role,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .first()
    )
    if row and _aware(row.expires_at) <= now:
        row = None
    if not row:
        # Grace period: token just rotated by another tab.
        grace_seconds = 45
        revoked = (
            db.query(RefreshToken)
            .filter(
                RefreshToken.token_hash == h,
                RefreshToken.role == role,
                RefreshToken.revoked_at.isnot(None),
            )
            .first()
        )
        if (
            revoked
            and revoked.revoked_at is not None
            and _aware(revoked.expires_at) > now
            and (now - _aware(revoked.revoked_at)).total_seconds() <= grace_seconds
        ):
            subject_id = revoked.subject_id
            new_raw = create_raw_refresh_token()
            expires = now + timedelta(days=settings.refresh_token_expire_days)
            db.add(
                RefreshToken(
                    id=new_uuid(),
                    subject_id=subject_id,
                    role=role,
                    token_hash=hash_refresh_token(new_raw),
                    expires_at=expires,
                    revoked_at=None,
                    created_at=now,
                )
            )
            db.commit()
            return subject_id, new_raw
        return None

    subject_id = row.subject_id
    row.revoked_at = now
    new_raw = create_raw_refresh_token()
    expires = now + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshToken(
            id=new_uuid(),
            subject_id=subject_id,
            role=role,
            token_hash=hash_refresh_token(new_raw),
            expires_at=expires,
            revoked_at=None,
            created_at=now,
        )
    )
    db.commit()
    return subject_id, new_raw
