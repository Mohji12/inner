from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: str
    role: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)


class ResendVerifyEmailRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str


class ResendVerifyEmailResponse(BaseModel):
    message: str
    verification_token: str | None = None


class VerifyEmailLinkRequest(BaseModel):
    token: str = Field(min_length=16, max_length=128)


class TwoFactorSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_base64: str


class TwoFactorVerifyRequest(BaseModel):
    code: str


class TwoFactorDisableRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    code: str = Field(min_length=6, max_length=6)


class TwoFactorLoginRequest(BaseModel):
    email: EmailStr
    code: str
    temp_token: str
    role: str
    timezone: str | None = None


class SocialLoginRequest(BaseModel):
    id_token: str
    link_password: str | None = Field(default=None, min_length=8, max_length=128)
    timezone: str | None = None


class LoginResponse(AccessTokenResponse):
    two_factor_required: bool = False
    temp_token: Optional[str] = None


class VerifyEmailLinkResponse(LoginResponse):
    user_id: str
    email: str
