from pydantic import BaseModel, EmailStr
from typing import Literal

class ForgotPasswordIn(BaseModel):
    email: EmailStr
    role: Literal["user", "mentor"]

class ResetPasswordIn(BaseModel):
    email: EmailStr
    role: Literal["user", "mentor"]
    code: str
    new_password: str

class PasswordResetMessage(BaseModel):
    message: str
