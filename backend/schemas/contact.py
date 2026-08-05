from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class SupportContactCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=64)
    role: Literal["user", "coach", "other"] = "user"
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=5000)


class AuthenticatedSupportCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=5000)
    phone: str | None = Field(default=None, max_length=64)


class SupportContactMessage(BaseModel):
    message: str
