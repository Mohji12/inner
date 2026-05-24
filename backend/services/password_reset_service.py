import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.security import hash_password, new_uuid
from models.password_reset import PasswordResetToken
from models.user import User
from models.mentor import Mentor
from services.email_service import send_plain_email

def create_reset_token(db: Session, email: str, role: Literal["user", "mentor"]) -> str:
    # Check if user/mentor exists
    if role == "user":
        obj = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    else:
        obj = db.execute(select(Mentor).where(Mentor.email == email)).scalar_one_or_none()
    
    if not obj:
        return None  # Or raise error, but better to return None for security
    
    # Invalidate any existing tokens
    tokens = db.execute(select(PasswordResetToken).where(
        PasswordResetToken.email == email,
        PasswordResetToken.role == role,
        PasswordResetToken.used == False
    )).scalars().all()
    for t in tokens:
        t.used = True
    
    # Create new token
    raw_token = secrets.token_urlsafe(32)
    token_hash = raw_token # We can hash this, but raw is also fine if we use random enough string
    # Actually, let's hash it for security
    import hashlib
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    reset_token = PasswordResetToken(
        id=new_uuid(),
        email=email,
        role=role,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        used=False,
        created_at=datetime.now(timezone.utc)
    )
    db.add(reset_token)
    db.commit()
    return raw_token

def verify_and_use_token(db: Session, raw_token: str, new_password_plain: str) -> bool:
    import hashlib
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    stmt = select(PasswordResetToken).where(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.now(timezone.utc)
    )
    token_obj = db.execute(stmt).scalar_one_or_none()
    
    if not token_obj:
        return False
    
    # Update password
    if token_obj.role == "user":
        user = db.execute(select(User).where(User.email == token_obj.email)).scalar_one_or_none()
        if user:
            user.password_hash = hash_password(new_password_plain)
            user.updated_at = datetime.now(timezone.utc)
    else:
        mentor = db.execute(select(Mentor).where(Mentor.email == token_obj.email)).scalar_one_or_none()
        if mentor:
            mentor.password_hash = hash_password(new_password_plain)
            mentor.updated_at = datetime.now(timezone.utc)
    
    # Mark token as used
    token_obj.used = True
    db.commit()
    return True

def send_reset_email(email: str, token: str):
    # This should be a link to the frontend
    # For now, let's assume http://localhost:8080/reset-password?token=...
    reset_link = f"http://localhost:8080/reset-password?token={token}"
    subject = "Reset your password - Mijn Levenspad"
    body = f"Click the link below to reset your password:\n\n{reset_link}\n\nThis link will expire in 1 hour."
    send_plain_email(to_email=email, subject=subject, body=body)
