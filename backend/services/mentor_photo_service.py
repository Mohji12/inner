"""Persist cropped (public) coach photos while keeping the original for re-edit."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import HTTPException, status

from models.mentor import Mentor

PhotoKind = Literal["avatar", "banner"]


def parse_crop_json(raw: str | None) -> dict[str, Any] | None:
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid crop data") from e
    if not isinstance(data, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid crop data")
    return data


def apply_mentor_display_photo(
    mentor: Mentor,
    *,
    kind: PhotoKind,
    cropped_url: str,
    original_url: str | None = None,
    crop: dict[str, Any] | None = None,
) -> dict[str, str | None]:
    """Write public URL plus original/crop metadata.

    If original is omitted and none is stored yet, keep the previous public URL
    (or the new crop) as the editor source.
    """
    if kind == "avatar":
        previous = (mentor.profile_image or "").strip() or None
        stored_original = (mentor.profile_image_original or "").strip() or None
        next_original = (original_url or "").strip() or None
        if next_original:
            mentor.profile_image_original = next_original
        elif not stored_original:
            mentor.profile_image_original = previous or cropped_url
        mentor.profile_image = cropped_url
        if crop is not None:
            mentor.profile_image_crop = crop
        original_out = mentor.profile_image_original
    else:
        previous = (mentor.banner_image or "").strip() or None
        stored_original = (mentor.banner_image_original or "").strip() or None
        next_original = (original_url or "").strip() or None
        if next_original:
            mentor.banner_image_original = next_original
        elif not stored_original:
            mentor.banner_image_original = previous or cropped_url
        mentor.banner_image = cropped_url
        if crop is not None:
            mentor.banner_image_crop = crop
        original_out = mentor.banner_image_original

    mentor.updated_at = datetime.now(timezone.utc)
    return {"url": cropped_url, "original_url": original_out}
