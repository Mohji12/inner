from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from api.deps import AnyActor, AnyActorDep, DbSession
from core.config import settings
from core.security import verify_password
from models.user import User
from models.mentor import Mentor
from services.cloudinary_service import upload_image_bytes

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = "uploads"
MAX_IMAGE_BYTES = 2 * 1024 * 1024  # 2 MB


def _ensure_upload_dir() -> None:
    import os

    os.makedirs(UPLOAD_DIR, exist_ok=True)


def _save_upload_local(contents: bytes, original_name: str, *, subdir: str | None = None) -> str:
    import os

    ext = original_name.split(".")[-1] if "." in original_name else "png"
    filename = f"{uuid4().hex}.{ext}"
    target_dir = os.path.join(UPLOAD_DIR, subdir) if subdir else UPLOAD_DIR
    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, filename)
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
    except Exception:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not save file") from None
    rel = f"{subdir}/{filename}" if subdir else filename
    return f"/uploads/{rel.replace(chr(92), '/')}"


def _store_image(contents: bytes, *, kind: Literal["avatar", "banner"], original_name: str) -> str:
    if settings.cloudinary_configured:
        try:
            return upload_image_bytes(contents, kind=kind)
        except Exception as e:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Image storage service failed. Try again or contact support.",
            ) from e
    return _save_upload_local(contents, original_name)


def store_chat_image(contents: bytes, *, session_id: str, original_name: str) -> str:
    """Store a chat attachment image; returns public URL path or Cloudinary HTTPS URL."""
    if settings.cloudinary_configured:
        try:
            return upload_image_bytes(contents, kind="chat", session_id=session_id)
        except Exception as e:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Image storage service failed. Try again or contact support.",
            ) from e
    return _save_upload_local(contents, original_name, subdir=f"chat/{session_id}")


async def _read_image_upload(file: UploadFile) -> bytes:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be an image")
    contents = await file.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Image must be at most {MAX_IMAGE_BYTES // (1024 * 1024)} MB",
        )
    if len(contents) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    return contents


_ensure_upload_dir()


@router.post("/mentor-register-avatar", response_model=dict)
async def upload_mentor_register_avatar(
    db: DbSession,
    email: str = Form(...),
    password: str = Form(...),
    file: UploadFile = File(...),
):
    """
    For mentors who are pending approval (cannot use Bearer login yet).
    Validates email/password, stores image on Cloudinary or local uploads, saves profile_image.
    """
    email_lc = email.strip().lower()
    mentor = db.query(Mentor).filter(Mentor.email == email_lc).first()
    if not mentor or not verify_password(password, mentor.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    contents = await _read_image_upload(file)
    file_url = _store_image(contents, kind="avatar", original_name=file.filename or "avatar.png")
    mentor.profile_image = file_url
    db.commit()
    return {"url": file_url}


def _persist_avatar(actor: AnyActor, db: DbSession, *, file_url: str) -> dict[str, str]:
    if actor.role == "user":
        user = db.query(User).filter(User.id == actor.subject_id).first()
        if user:
            user.profile_image = file_url
        db.commit()
        return {"url": file_url}
    if actor.role == "mentor":
        mentor = db.query(Mentor).filter(Mentor.id == actor.subject_id).first()
        if mentor:
            mentor.profile_image = file_url
        db.commit()
        return {"url": file_url}
    if actor.role == "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins cannot upload profile images via this endpoint")
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Unsupported role")


def _persist_banner(actor: AnyActor, db: DbSession, *, file_url: str) -> dict[str, str]:
    if actor.role != "mentor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only mentors can upload a banner image")
    mentor = db.query(Mentor).filter(Mentor.id == actor.subject_id).first()
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mentor not found")
    mentor.banner_image = file_url
    db.commit()
    return {"url": file_url}


@router.post("/avatar", response_model=dict)
async def upload_avatar(
    actor: AnyActorDep,
    db: DbSession,
    file: UploadFile = File(...),
):
    """Profile picture for authenticated user or mentor (Bearer token role)."""
    contents = await _read_image_upload(file)
    file_url = _store_image(contents, kind="avatar", original_name=file.filename or "image.png")
    return _persist_avatar(actor, db, file_url=file_url)


@router.post("/banner", response_model=dict)
async def upload_banner(
    actor: AnyActorDep,
    db: DbSession,
    file: UploadFile = File(...),
):
    """Wide banner/card image — mentors only."""
    contents = await _read_image_upload(file)
    file_url = _store_image(contents, kind="banner", original_name=file.filename or "banner.png")
    return _persist_banner(actor, db, file_url=file_url)


@router.post("/image", response_model=dict)
async def upload_image(
    actor: AnyActorDep,
    db: DbSession,
    kind: Literal["avatar", "banner"] = Query(default="avatar"),
    file: UploadFile = File(...),
):
    """Unified upload: `avatar` for user/mentor; `banner` for mentors only."""
    contents = await _read_image_upload(file)
    suffix = "banner.png" if kind == "banner" else "image.png"
    file_url = _store_image(
        contents,
        kind="banner" if kind == "banner" else "avatar",
        original_name=file.filename or suffix,
    )
    if kind == "banner":
        return _persist_banner(actor, db, file_url=file_url)
    return _persist_avatar(actor, db, file_url=file_url)
