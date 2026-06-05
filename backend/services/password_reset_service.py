import logging
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.security import hash_password, new_uuid
from models.user import User
from models.mentor import Mentor
from services.otp_service import (
    create_and_send_password_reset_otp,
    password_reset_otp_role,
    verify_otp,
)

logger = logging.getLogger(__name__)


def request_password_reset_otp(db: Session, email: str, role: Literal["user", "mentor"]) -> bool:
    email_l = email.lower()
    if role == "user":
        obj = db.execute(select(User).where(User.email == email_l)).scalar_one_or_none()
    else:
        obj = db.execute(select(Mentor).where(Mentor.email == email_l)).scalar_one_or_none()

    if not obj:
        return False

    try:
        create_and_send_password_reset_otp(
            db,
            email=email_l,
            role=role,
            subject_id=obj.id,
            otp_id=new_uuid(),
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to send password reset OTP to %s", email_l)
        raise
    return True


def reset_password_with_otp(
    db: Session,
    *,
    email: str,
    role: Literal["user", "mentor"],
    code: str,
    new_password_plain: str,
) -> bool:
    email_l = email.lower()
    otp_role = password_reset_otp_role(role)
    subject_id = verify_otp(db, email=email_l, role=otp_role, code=code)
    if not subject_id:
        return False

    if role == "user":
        user = db.execute(select(User).where(User.id == subject_id)).scalar_one_or_none()
        if not user or user.email.lower() != email_l:
            return False
        user.password_hash = hash_password(new_password_plain)
        user.updated_at = datetime.now(timezone.utc)
    else:
        mentor = db.execute(select(Mentor).where(Mentor.id == subject_id)).scalar_one_or_none()
        if not mentor or mentor.email.lower() != email_l:
            return False
        mentor.password_hash = hash_password(new_password_plain)
        mentor.updated_at = datetime.now(timezone.utc)

    db.commit()
    return True
