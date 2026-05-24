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


class TwoFactorSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_base64: str


class TwoFactorVerifyRequest(BaseModel):
    code: str


class TwoFactorLoginRequest(BaseModel):
    email: EmailStr
    code: str
    temp_token: str
    role: str


class SocialLoginRequest(BaseModel):
    id_token: str


class LoginResponse(AccessTokenResponse):
    two_factor_required: bool = False
    temp_token: Optional[str] = None
