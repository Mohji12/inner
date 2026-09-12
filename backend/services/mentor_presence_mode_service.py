"""Coach presence mode (online / offline / paused / occupied) helpers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from models.mentor import Mentor
from services.presence_service import ONLINE_TTL_SECONDS, presence_service

PRESENCE_MODES = frozenset({"online", "offline", "paused", "occupied"})


def normalize_presence_mode(raw: str | None, *, manual_occupied: bool = False) -> str:
    mode = (raw or "").strip().lower()
    if mode in PRESENCE_MODES:
        return mode
    return "paused" if manual_occupied else "online"


def mentor_presence_mode(db: Session, mentor_id: str) -> str:
    row = (
        db.query(Mentor.presence_mode, Mentor.manual_occupied)
        .filter(Mentor.id == mentor_id)
        .first()
    )
    if not row:
        return "online"
    return normalize_presence_mode(row[0], manual_occupied=bool(row[1]))


def apply_presence_mode(mentor: Mentor, mode: str, *, now: datetime | None = None) -> str:
    """Persist coach-selected mode and sync online/occupied flags."""
    resolved = normalize_presence_mode(mode)
    stamp = now or datetime.now(timezone.utc)
    mentor.presence_mode = resolved
    mentor.updated_at = stamp

    if resolved == "online":
        mentor.manual_occupied = False
        presence_service.set_online(mentor.id, "mentor")
        mentor.last_seen_at = stamp
    elif resolved == "offline":
        mentor.manual_occupied = False
        presence_service.set_offline(mentor.id, "mentor")
        # Age last_seen so DB fallback also reports offline across workers.
        mentor.last_seen_at = stamp - timedelta(seconds=ONLINE_TTL_SECONDS + 60)
    else:
        # paused / occupied: stay connected but not bookable
        mentor.manual_occupied = True
        presence_service.set_online(mentor.id, "mentor")
        mentor.last_seen_at = stamp

    return resolved


def effective_is_online(mentor: Mentor) -> bool:
    mode = normalize_presence_mode(
        getattr(mentor, "presence_mode", None),
        manual_occupied=bool(getattr(mentor, "manual_occupied", False)),
    )
    if mode == "offline":
        return False
    return presence_service.is_online(mentor.id, "mentor", last_seen_at=mentor.last_seen_at)
