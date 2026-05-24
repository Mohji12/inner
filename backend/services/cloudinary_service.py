"""Upload images to Cloudinary when credentials are set in settings."""

from __future__ import annotations

import io
import logging
from typing import Literal
from uuid import uuid4

import cloudinary
import cloudinary.uploader

from core.config import settings

logger = logging.getLogger(__name__)

Kind = Literal["avatar", "banner"]


def _configure() -> None:
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name.strip(),
        api_key=settings.cloudinary_api_key.strip(),
        api_secret=settings.cloudinary_api_secret.strip(),
        secure=True,
    )


def upload_image_bytes(contents: bytes, *, kind: Kind) -> str:
    """Upload raw image bytes; returns HTTPS URL (secure_url)."""
    if not settings.cloudinary_configured:
        raise RuntimeError("Cloudinary is not configured; set CLOUDINARY_CLOUD_NAME, API_KEY, and API_SECRET")
    _configure()
    folder = "profiles/avatars" if kind == "avatar" else "profiles/banners"
    public_id = f"{kind}_{uuid4().hex}"
    try:
        result = cloudinary.uploader.upload(
            io.BytesIO(contents),
            folder=folder,
            public_id=public_id,
            resource_type="image",
            use_filename=False,
            unique_filename=False,
        )
    except Exception:
        logger.exception("Cloudinary upload failed")
        raise
    url = result.get("secure_url") or result.get("url")
    if not url:
        raise RuntimeError("Cloudinary returned no URL")
    return str(url)
