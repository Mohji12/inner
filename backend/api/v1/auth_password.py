from fastapi import APIRouter, HTTPException, status
from api.deps import DbSession
from schemas.password_reset import ForgotPasswordIn, ResetPasswordIn, PasswordResetMessage
from services.password_reset_service import create_reset_token, verify_and_use_token, send_reset_email
from core.security import validate_password_strength

router = APIRouter(prefix="/auth", tags=["auth-password"])

@router.post("/forgot-password", response_model=PasswordResetMessage)
def forgot_password(db: DbSession, payload: ForgotPasswordIn):
    token = create_reset_token(db, email=payload.email, role=payload.role)
    if token:
        send_reset_email(email=payload.email, token=token)
    
    # Always return success to prevent email enumeration
    return PasswordResetMessage(message="If an account exists with this email, a reset link has been sent.")

@router.post("/reset-password", response_model=PasswordResetMessage)
def reset_password(db: DbSession, payload: ResetPasswordIn):
    password_error = validate_password_strength(payload.new_password)
    if password_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=password_error)
        
    success = verify_and_use_token(db, raw_token=payload.token, new_password_plain=payload.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    return PasswordResetMessage(message="Password has been reset successfully. You can now log in.")
