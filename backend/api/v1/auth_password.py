from fastapi import APIRouter, HTTPException, status

from api.deps import DbSession
from schemas.password_reset import ForgotPasswordIn, ResetPasswordIn, PasswordResetMessage
from services.password_reset_service import request_password_reset_otp, reset_password_with_otp
from core.security import validate_password_strength

router = APIRouter(prefix="/auth", tags=["auth-password"])


@router.post("/forgot-password", response_model=PasswordResetMessage)
def forgot_password(db: DbSession, payload: ForgotPasswordIn):
    try:
        request_password_reset_otp(db, email=str(payload.email), role=payload.role)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send reset code. Please try again later.",
        )

    return PasswordResetMessage(
        message="If an account exists with this email, a reset code has been sent."
    )


@router.post("/reset-password", response_model=PasswordResetMessage)
def reset_password(db: DbSession, payload: ResetPasswordIn):
    password_error = validate_password_strength(payload.new_password)
    if password_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=password_error)

    code = payload.code.strip()
    if len(code.replace(" ", "")) != 6 or not code.replace(" ", "").isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset code",
        )

    success = reset_password_with_otp(
        db,
        email=str(payload.email),
        role=payload.role,
        code=code,
        new_password_plain=payload.new_password,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code",
        )
    return PasswordResetMessage(message="Password has been reset successfully. You can now log in.")
