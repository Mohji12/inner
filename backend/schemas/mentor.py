from datetime import datetime  # noqa: TC003 — used by MentorAccountOut
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class MentorLogin(BaseModel):
    email: EmailStr
    password: str


class PublicCardVisibility(BaseModel):
    headline: bool = True
    expertise_tags: bool = True
    years_experience: bool = True
    rating: bool = True
    session_packages: bool = True
    profile_photo: bool = True
    banner_photo: bool = True


class MentorRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str
    password: str = Field(min_length=8)
    country_code: str | None = Field(default=None, max_length=2)
    headline: str | None = None
    bio: str | None = None
    headline_i18n: dict[str, str] | None = None
    bio_i18n: dict[str, str] | None = None
    profile_image: str | None = Field(default=None, max_length=512)
    current_company: str | None = Field(default=None, max_length=255)
    kvk_number: str | None = Field(default=None, max_length=32)
    languages_spoken: list[str] | None = None
    years_of_experience: int | None = None
    expertise_areas: list[str] | None = None
    skills: list[str] | None = None
    education: list[str] | None = None
    certifications: list[str] | None = None
    tools_technologies: list[str] | None = None
    session_modes: list[str] | None = None
    public_card_visibility: PublicCardVisibility | dict[str, bool] | None = None
    agreement_accepted: bool = False
    agreement_version: str | None = None
    agreement_text_snapshot: str | None = None


class MentorCreate(BaseModel):
    """Internal / admin-style create."""

    full_name: str
    email: EmailStr
    phone_number: str
    password: str
    headline: str | None = None
    bio: str | None = None
    languages_spoken: list[str] | None = None
    years_of_experience: int = 0


class MentorPublicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    country_code: str | None = None
    timezone: str = "UTC"
    headline: str | None
    current_company: str | None = None
    profile_image: str | None
    banner_image: str | None = None
    languages_spoken: list[Any] | None
    years_of_experience: int
    expertise_areas: list[Any] | None
    skills: list[Any] | None
    average_rating: Decimal
    total_reviews: int
    total_sessions_completed: int
    is_verified: bool
    chat_price_per_minute: Decimal = Decimal("0")
    chat_currency: str = "EUR"
    chat_min_purchase_minutes: int = 1
    chat_available: bool = False
    is_online: bool = False
    last_seen_at: datetime | None = None
    status: str
    created_at: datetime
    badges: list[str] = Field(default_factory=list)
    # Global session pricing active and mentor approved + active — show 10/20/30 packages
    session_packages_available: bool = False
    public_card_visibility: dict[str, bool] | None = None


class MentorDetailOut(MentorPublicOut):
    bio: str | None
    current_company: str | None
    kvk_number: str | None = None
    previous_companies: list[Any] | None
    education: list[Any] | None
    certifications: list[Any] | None
    tools_technologies: list[Any] | None
    session_modes: list[Any] | None


class MentorAccountOut(MentorDetailOut):
    """Logged-in mentor's own profile (includes contact fields)."""

    email: str
    phone_number: str
    is_approved: bool
    is_verified: bool
    email_verified: bool
    agreement_accepted_at: datetime | None = None
    agreement_version: str | None = None
    updated_at: datetime


class CoachAgreementAcceptIn(BaseModel):
    signature_name: str = Field(min_length=2, max_length=255)
    agreement_version: str
    agreement_text_snapshot: str


class MentorRegisterResponse(MentorAccountOut):
    """Register response; `dev_verification_code` is set only when SMTP is not configured (local dev)."""

    dev_verification_code: str | None = None


class MentorUpdate(BaseModel):
    full_name: str | None = None
    country_code: str | None = None
    timezone: str | None = None
    profile_image: str | None = None
    banner_image: str | None = None
    headline: str | None = None
    headline_i18n: dict[str, str] | None = None
    bio: str | None = None
    bio_i18n: dict[str, str] | None = None
    languages_spoken: list[Any] | None = None
    years_of_experience: int | None = None
    current_company: str | None = None
    kvk_number: str | None = Field(default=None, max_length=32)
    previous_companies: list[Any] | None = None
    education: list[Any] | None = None
    certifications: list[Any] | None = None
    expertise_areas: list[Any] | None = None
    skills: list[Any] | None = None
    tools_technologies: list[Any] | None = None
    session_modes: list[Any] | None = None
    chat_price_per_minute: Decimal | None = None
    chat_currency: str | None = None
    chat_min_purchase_minutes: int | None = None
    public_card_visibility: PublicCardVisibility | dict[str, bool] | None = None


class PlatformPricingPublicOut(BaseModel):
    price_5_min: Decimal
    price_10_min: Decimal
    price_20_min: Decimal
    price_30_min: Decimal
    price_60_min: Decimal
    currency: str
    is_active: bool


class MentorPayoutBankDetailsIn(BaseModel):
    account_holder_name: str = Field(min_length=2, max_length=255)
    iban: str = Field(min_length=15, max_length=42)
    bic: str | None = Field(default=None, max_length=11)


class MentorPayoutBankDetailsOut(BaseModel):
    has_bank_details: bool
    account_holder_name: str | None = None
    iban_masked: str | None = None
    bic_masked: str | None = None
    status: str = "none"
    verified_at: datetime | None = None
    updated_at: datetime | None = None
