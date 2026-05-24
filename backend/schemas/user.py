from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str
    password: str = Field(min_length=8)
    preferred_language: str = "en"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    phone_number: str
    profile_image: str | None
    gender: str | None
    date_of_birth: date | None
    location: str | None
    country_code: str | None
    timezone: str
    preferred_language: str
    interests: list[Any] | None
    goals: str | None
    preferred_categories: list[Any] | None
    preferred_communication_mode: str | None
    last_login: datetime | None
    account_status: str
    email_verified: bool
    created_at: datetime
    updated_at: datetime


class UserRegisterResponse(UserOut):
    """Register response; `dev_verification_code` is set only when SMTP is not configured (local dev)."""

    dev_verification_code: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    profile_image: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    location: str | None = None
    country_code: str | None = None
    timezone: str | None = None
    preferred_language: str | None = None
    interests: list[Any] | None = None
    goals: str | None = None
    preferred_categories: list[Any] | None = None
    preferred_communication_mode: str | None = None


class DateAmountPoint(BaseModel):
    date: str
    amount: str


class UserSpendingSeriesOut(BaseModel):
    period: str
    range_start: datetime
    range_end: datetime
    bookings_by_day: list[DateAmountPoint]
    chat_by_day: list[DateAmountPoint]
