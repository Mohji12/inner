from __future__ import annotations

from copy import deepcopy
from decimal import Decimal
from typing import Any

from schemas.mentor import MentorPublicOut

DEFAULT_CARD_VISIBILITY: dict[str, bool] = {
    "headline": True,
    "expertise_tags": True,
    "years_experience": True,
    "rating": True,
    "session_packages": True,
    "profile_photo": True,
    "banner_photo": True,
}

CARD_VISIBILITY_KEYS = frozenset(DEFAULT_CARD_VISIBILITY.keys())


def normalize_card_visibility(raw: dict[str, Any] | None) -> dict[str, bool]:
    merged = deepcopy(DEFAULT_CARD_VISIBILITY)
    if not raw:
        return merged
    for key in CARD_VISIBILITY_KEYS:
        if key in raw:
            merged[key] = bool(raw[key])
    return merged


def apply_card_visibility_to_public(
    out: MentorPublicOut,
    visibility: dict[str, bool],
) -> MentorPublicOut:
    vis = normalize_card_visibility(visibility)
    updates: dict[str, Any] = {"public_card_visibility": vis}

    # Company name and KVK are never exposed on public cards/API.
    updates["current_company"] = None
    if not vis["headline"]:
        updates["headline"] = None
    if not vis["expertise_tags"]:
        updates["expertise_areas"] = None
        updates["skills"] = None
    if not vis["years_experience"]:
        updates["years_of_experience"] = 0
    if not vis["rating"]:
        updates["average_rating"] = Decimal("0")
        updates["total_reviews"] = 0
        updates["badges"] = [b for b in (out.badges or []) if b != "Top Rated"]
    if not vis["session_packages"]:
        updates["session_packages_available"] = False
    if not vis["profile_photo"]:
        updates["profile_image"] = None
    if not vis["banner_photo"]:
        updates["banner_image"] = None

    return out.model_copy(update=updates)
