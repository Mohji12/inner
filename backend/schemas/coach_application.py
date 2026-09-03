from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CoachApplicationCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone_number: str = Field(min_length=6, max_length=64)
    headline: str = Field(min_length=3, max_length=512)
    motivation: str = Field(min_length=20, max_length=5000)
    years_of_experience: int = Field(default=0, ge=0, le=80)
    languages_spoken: list[str] | None = None
    website_or_social: str | None = Field(default=None, max_length=512)


class CoachApplicationMessage(BaseModel):
    message: str


CoachApplicationStatus = Literal["new", "reviewed", "contacted", "rejected"]


class AdminCoachApplicationRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    phone_number: str
    headline: str
    motivation: str
    years_of_experience: int
    languages_spoken: list[str] | None
    website_or_social: str | None
    status: str
    admin_notes: str | None
    created_at: datetime
    updated_at: datetime


class AdminCoachApplicationList(BaseModel):
    items: list[AdminCoachApplicationRow]
    total: int
    skip: int
    limit: int


class AdminCoachApplicationUpdate(BaseModel):
    status: CoachApplicationStatus | None = None
    admin_notes: str | None = Field(default=None, max_length=5000)
