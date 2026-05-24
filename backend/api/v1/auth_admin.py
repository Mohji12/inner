from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response, status

from api.deps import DbSession
from core.config import settings
from core.security import create_access_token, verify_password
from models.admin import Admin
from schemas.auth import AccessTokenResponse
from schemas.user import UserLogin
from services.token_service import revoke_refresh_token, rotate_refresh_token, store_refresh_token

router = APIRouter(prefix="/auth/admin", tags=["auth-admin"])


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        key=settings.admin_refresh_cookie,
        value=raw,
        max_age=settings.refresh_token_expire_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.admin_refresh_cookie,
        path="/",
        domain=settings.cookie_domain,
        samesite=settings.cookie_samesite,
    )


@router.post("/login", response_model=AccessTokenResponse)
def login_admin(db: DbSession, payload: UserLogin, response: Response) -> AccessTokenResponse:
    email = str(payload.email).lower()
    admin = db.query(Admin).filter(Admin.email == email).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    admin.updated_at = datetime.now(timezone.utc)
    db.commit()
    raw_refresh = store_refresh_token(db, subject_id=admin.id, role="admin")
    _set_refresh_cookie(response, raw_refresh)
    access = create_access_token(admin.id, "admin")
    return AccessTokenResponse(
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh_admin_token(db: DbSession, request: Request, response: Response) -> AccessTokenResponse:
    raw = request.cookies.get(settings.admin_refresh_cookie)
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing refresh cookie")
    rotated = rotate_refresh_token(db, raw, "admin")
    if not rotated:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    subject_id, new_raw = rotated
    _set_refresh_cookie(response, new_raw)
    admin = db.query(Admin).filter(Admin.id == subject_id).first()
    if not admin:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin not found")
    access = create_access_token(subject_id, "admin")
    return AccessTokenResponse(
        access_token=access,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_admin(db: DbSession, request: Request, response: Response) -> None:
    raw = request.cookies.get(settings.admin_refresh_cookie)
    if raw:
        revoke_refresh_token(db, raw, "admin")
    _clear_refresh_cookie(response)
