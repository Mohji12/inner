from datetime import date, datetime

from sqlalchemy import JSON, CHAR, Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    profile_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(32), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    preferred_language: Mapped[str] = mapped_column(String(32), default="en")
    interests: Mapped[list | None] = mapped_column(JSON, nullable=True)
    goals: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_categories: Mapped[list | None] = mapped_column(JSON, nullable=True)
    preferred_communication_mode: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    account_status: Mapped[str] = mapped_column(String(32), default="active")
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    theme_preference: Mapped[str] = mapped_column(String(16), default="system")
    
    # 2FA / Social
    totp_secret: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    bookings = relationship("Booking", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    reviews = relationship("Review", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")
    chat_purchases = relationship("ChatPurchase", back_populates="user")
    waitlist_entries = relationship("WaitlistEntry", back_populates="user")
