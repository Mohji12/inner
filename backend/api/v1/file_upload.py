from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from api.deps import AnyActor, AnyActorDep, DbSession
from core.config import settings
from core.security import verify_password
from models.user import User
from models.mentor import Mentor
from services.cloudinary_service import upload_image_bytes
from services.mentor_card_visibility import normalize_card_visibility
from services.mentor_photo_service import apply_mentor_display_photo, parse_crop_json

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = "uploads"
MAX_IMAGE_BYTES = 2 * 1024 * 1024  # 2 MB



def _ensure_upload_dir() -> None:
    import os

    os.makedirs(UPLOAD_DIR, exist_ok=True)


def _looks_like_image(contents: bytes, content_type: str | None, filename: str | None) -> bool:
    """Accept common image MIME types, or sniff magic bytes when browsers omit type (Safari/HEIC quirks)."""
    if content_type and content_type.startswith("image/"):
        return True
    name = (filename or "").lower()
    if name.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".heif")):
        return True
    if len(contents) >= 3 and contents[:3] == b"\xff\xd8\xff":
        return True  # JPEG
    if len(contents) >= 8 and contents[:8] == b"\x89PNG\r\n\x1a\n":
        return True
    if len(contents) >= 6 and contents[:6] in (b"GIF87a", b"GIF89a"):
        return True
    if len(contents) >= 12 and contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return True
    return False


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
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Image size should be less than 2 MB.",
        )
    name = (file.filename or "").lower()
    ctype = (file.content_type or "").lower()
    heic_brand = False
    if len(contents) >= 12 and contents[4:8] == b"ftyp":
        brand = contents[8:12].lower()
        heic_brand = brand in {b"heic", b"heif", b"mif1", b"msf1"}
    if (
        name.endswith((".heic", ".heif"))
        or ctype in {
            "image/heic",
            "image/heif",
            "image/heic-sequence",
            "image/heif-sequence",
        }
        or heic_brand
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "HEIC/HEIF photos are not supported. Please upload a JPG or PNG instead.",
        )
    if not _looks_like_image(contents, file.content_type, file.filename):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be an image (JPG, PNG, WebP, or GIF)")
    return contents


_ensure_upload_dir()


async def _read_optional_image_upload(file: UploadFile | None) -> bytes | None:
    if file is None:
        return None
    filename = (file.filename or "").strip()
    if not filename:
        return None
    return await _read_image_upload(file)


@router.post("/mentor-register-avatar", response_model=dict)
async def upload_mentor_register_avatar(
    db: DbSession,
    email: str = Form(...),
    password: str = Form(...),
    file: UploadFile = File(...),
    original: UploadFile | None = File(None),
    crop: str | None = Form(None),
):
    """
    For mentors who are pending approval (cannot use Bearer login yet).
    Validates email/password, stores image on Cloudinary or local uploads, saves profile_image.
    """
    email_lc = email.strip().lower()
    mentor = db.query(Mentor).filter(Mentor.email == email_lc).first()
    if not mentor or not verify_password(password, mentor.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    original_bytes = await _read_optional_image_upload(original)
    contents = await _read_image_upload(file)
    original_url = None
    if original_bytes:
        original_url = _store_image(
            original_bytes, kind="avatar", original_name=original.filename if original else "original.jpg"
        )
    file_url = _store_image(contents, kind="avatar", original_name=file.filename or "avatar.png")
    apply_mentor_display_photo(
        mentor,
        kind="avatar",
        cropped_url=file_url,
        original_url=original_url,
        crop=parse_crop_json(crop),
    )
    vis = normalize_card_visibility(getattr(mentor, "public_card_visibility", None))
    if not vis.get("profile_photo", True):
        vis["profile_photo"] = True
        mentor.public_card_visibility = vis
    db.commit()
    return {"url": file_url, "original_url": mentor.profile_image_original}


def _persist_avatar(
    actor: AnyActor,
    db: DbSession,
    *,
    file_url: str,
    original_url: str | None = None,
    crop: dict | None = None,
) -> dict[str, str | None]:
    if actor.role == "user":
        user = db.query(User).filter(User.id == actor.subject_id).first()
        if user:
            user.profile_image = file_url
        db.commit()
        return {"url": file_url, "original_url": None}
    if actor.role == "mentor":
        mentor = db.query(Mentor).filter(Mentor.id == actor.subject_id).first()
        if not mentor:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Mentor not found")
        result = apply_mentor_display_photo(
            mentor,
            kind="avatar",
            cropped_url=file_url,
            original_url=original_url,
            crop=crop,
        )
        vis = normalize_card_visibility(getattr(mentor, "public_card_visibility", None))
        if not vis.get("profile_photo", True):
            vis["profile_photo"] = True
            mentor.public_card_visibility = vis
        db.commit()
        return result
    if actor.role == "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins cannot upload profile images via this endpoint")
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Unsupported role")


def _persist_banner(
    actor: AnyActor,
    db: DbSession,
    *,
    file_url: str,
    original_url: str | None = None,
    crop: dict | None = None,
) -> dict[str, str | None]:
    if actor.role != "mentor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only mentors can upload a banner image")
    mentor = db.query(Mentor).filter(Mentor.id == actor.subject_id).first()
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mentor not found")
    result = apply_mentor_display_photo(
        mentor,
        kind="banner",
        cropped_url=file_url,
        original_url=original_url,
        crop=crop,
    )
    vis = normalize_card_visibility(getattr(mentor, "public_card_visibility", None))
    if not vis.get("banner_photo", True):
        vis["banner_photo"] = True
        mentor.public_card_visibility = vis
    db.commit()
    return result


@router.post("/avatar", response_model=dict)
async def upload_avatar(
    actor: AnyActorDep,
    db: DbSession,
    file: UploadFile = File(...),
    original: UploadFile | None = File(None),
    crop: str | None = Form(None),
):
    """Profile picture for authenticated user or mentor (Bearer token role)."""
    original_bytes = await _read_optional_image_upload(original)
    contents = await _read_image_upload(file)
    original_url = None
    if original_bytes:
        original_url = _store_image(
            original_bytes, kind="avatar", original_name=original.filename if original else "original.jpg"
        )
    file_url = _store_image(contents, kind="avatar", original_name=file.filename or "image.png")
    return _persist_avatar(
        actor,
        db,
        file_url=file_url,
        original_url=original_url,
        crop=parse_crop_json(crop),
    )


@router.post("/banner", response_model=dict)
async def upload_banner(
    actor: AnyActorDep,
    db: DbSession,
    file: UploadFile = File(...),
    original: UploadFile | None = File(None),
    crop: str | None = Form(None),
):
    """Wide banner/card image — mentors only."""
    original_bytes = await _read_optional_image_upload(original)
    contents = await _read_image_upload(file)
    original_url = None
    if original_bytes:
        original_url = _store_image(
            original_bytes, kind="banner", original_name=original.filename if original else "original.jpg"
        )
    file_url = _store_image(contents, kind="banner", original_name=file.filename or "banner.png")
    return _persist_banner(
        actor,
        db,
        file_url=file_url,
        original_url=original_url,
        crop=parse_crop_json(crop),
    )


@router.post("/image", response_model=dict)
async def upload_image(
    actor: AnyActorDep,
    db: DbSession,
    kind: Literal["avatar", "banner"] = Query(default="avatar"),
    file: UploadFile = File(...),
    original: UploadFile | None = File(None),
    crop: str | None = Form(None),
):
    """Unified upload: `avatar` for user/mentor; `banner` for mentors only."""
    original_bytes = await _read_optional_image_upload(original)
    contents = await _read_image_upload(file)
    suffix = "banner.png" if kind == "banner" else "image.png"
    original_url = None
    store_kind: Literal["avatar", "banner"] = "banner" if kind == "banner" else "avatar"
    if original_bytes:
        original_url = _store_image(
            original_bytes,
            kind=store_kind,
            original_name=original.filename if original else "original.jpg",
        )
    file_url = _store_image(
        contents,
        kind=store_kind,
        original_name=file.filename or suffix,
    )
    parsed_crop = parse_crop_json(crop)
    if kind == "banner":
        return _persist_banner(actor, db, file_url=file_url, original_url=original_url, crop=parsed_crop)
    return _persist_avatar(actor, db, file_url=file_url, original_url=original_url, crop=parsed_crop)
