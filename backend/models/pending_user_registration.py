from datetime import datetime

from sqlalchemy import CHAR, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class PendingUserRegistration(Base):
    """Signup data held until email OTP or verify-link succeeds — no `users` row yet."""

    __tablename__ = "pending_user_registrations"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    preferred_language: Mapped[str] = mapped_column(String(32), default="en")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    verify_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    verify_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
