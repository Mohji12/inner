from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, CHAR, Boolean, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Mentor(Base):
    __tablename__ = "mentors"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    password_hash: Mapped[str] = mapped_column(String(255))
    profile_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    banner_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(512), nullable=True)
    headline_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    languages_spoken: Mapped[list | None] = mapped_column(JSON, nullable=True)
    years_of_experience: Mapped[int] = mapped_column(Integer, default=0)
    current_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    kvk_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    previous_companies: Mapped[list | None] = mapped_column(JSON, nullable=True)
    education: Mapped[list | None] = mapped_column(JSON, nullable=True)
    certifications: Mapped[list | None] = mapped_column(JSON, nullable=True)
    expertise_areas: Mapped[list | None] = mapped_column(JSON, nullable=True)
    skills: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tools_technologies: Mapped[list | None] = mapped_column(JSON, nullable=True)
    session_modes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    price_10_min: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    price_20_min: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    price_30_min: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    average_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0"))
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)
    total_sessions_completed: Mapped[int] = mapped_column(Integer, default=0)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    theme_preference: Mapped[str] = mapped_column(String(16), default="system")
    chat_price_per_minute: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.90"))
    chat_currency: Mapped[str] = mapped_column(String(8), default="EUR")
    
    # 2FA / Social
    totp_secret: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    chat_min_purchase_minutes: Mapped[int] = mapped_column(Integer, default=1)
    agreement_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    agreement_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    agreement_text_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    agreement_text_snapshot_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    slots = relationship("AvailabilitySlot", back_populates="mentor", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="mentor")
    reviews = relationship("Review", back_populates="mentor")
    chat_sessions = relationship("ChatSession", back_populates="mentor")
    waitlist_entries = relationship("WaitlistEntry", back_populates="mentor")
