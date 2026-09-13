"""Coach manual occupied flag and shared chat-availability helpers."""

from sqlalchemy.orm import Session

from models.mentor import Mentor


def mentor_manual_occupied(db: Session, mentor_id: str) -> bool:
    row = db.query(Mentor.manual_occupied).filter(Mentor.id == mentor_id).first()
    return bool(row and row[0])


def mentor_is_occupied(mentor: Mentor) -> bool:
    """True when coach is paused/occupied — matches public listing rules."""
    from services.mentor_presence_mode_service import normalize_presence_mode

    mode = normalize_presence_mode(
        getattr(mentor, "presence_mode", None),
        manual_occupied=bool(getattr(mentor, "manual_occupied", False)),
    )
    return mode in ("paused", "occupied") or bool(getattr(mentor, "manual_occupied", False))


def compute_chat_available(
    *,
    online: bool,
    busy: bool,
    unavailable_schedule: bool,
    manual_occupied: bool,
) -> bool:
    return online and not busy and not unavailable_schedule and not manual_occupied


def live_availability_block_reason(
    db: Session,
    mentor: Mentor,
    *,
    require_chat_rate: bool = False,
) -> str | None:
    """
    Same gates as public chat_available / chat-availability.
    Returns a machine code when the coach cannot take a new live session, else None.
    """
    from services.chat_service import mentor_chat_busy
    from services.mentor_presence_mode_service import effective_is_online
    from services.mentor_unavailability_service import mentor_unavailable_now
    from services.pricing_service import effective_chat_price_per_minute_eur

    if not mentor.is_approved or mentor.status != "active":
        return "mentor_inactive"
    if require_chat_rate and effective_chat_price_per_minute_eur(mentor) <= 0:
        return "chat_disabled"
    if mentor_chat_busy(db, mentor.id):
        return "mentor_busy"
    if not effective_is_online(mentor):
        return "mentor_offline"
    if mentor_unavailable_now(db, mentor.id):
        return "mentor_unavailable"
    if mentor_is_occupied(mentor):
        return "mentor_occupied"
    return None
