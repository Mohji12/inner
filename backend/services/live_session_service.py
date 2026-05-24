"""Shared live-session context for chat messaging and WebRTC meetings."""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from core.chat_states import (
    CHAT_SESSION_ACTIVE,
    CHAT_SESSION_ENDED,
    CHAT_SESSION_PAUSED,
)
from models.booking import Booking
from models.chat_session import ChatSession
from services.livekit_call_token import livekit_room_name_for_session
from services.presence_service import presence_service

BOOKING_COMM_MODES = frozenset({"video", "call"})


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def remaining_seconds(ends_at: datetime) -> int:
    now = _utcnow()
    if ends_at.tzinfo is None:
        ends_at = ends_at.replace(tzinfo=timezone.utc)
    delta = (ends_at - now).total_seconds()
    return max(0, int(delta))


def booking_for_chat_session(db: Session, session_id: str) -> Booking | None:
    needle = f"/chat/{session_id}"
    return (
        db.query(Booking)
        .filter(Booking.meeting_link.isnot(None), Booking.meeting_link.contains(needle))
        .order_by(Booking.created_at.desc())
        .first()
    )


def communication_mode_for_session(db: Session, session_id: str) -> str | None:
    """Return booking communication mode (video/call) when chat was created from a paid booking."""
    booking = booking_for_chat_session(db, session_id)
    if not booking or not booking.communication_mode:
        return None
    mode = booking.communication_mode.strip().lower()
    return mode if mode in BOOKING_COMM_MODES else None


def sync_session_time_state(session: ChatSession) -> None:
    """If time expired while still marked active, move to paused (lazy transition)."""
    if session.status != CHAT_SESSION_ACTIVE:
        return
    if remaining_seconds(session.ends_at) <= 0:
        session.status = CHAT_SESSION_PAUSED
        session.updated_at = _utcnow()


def activate_session_on_participant_join(db: Session, session_id: str) -> None:
    """Start a paid booking chat when someone opens the room; mark the coach offline for new bookings."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).with_for_update().first()
    if not session:
        return
    now = _utcnow()
    if session.status == CHAT_SESSION_PAUSED and remaining_seconds(session.ends_at) > 0:
        session.status = CHAT_SESSION_ACTIVE
        session.updated_at = now
    if session.status == CHAT_SESSION_ACTIVE and remaining_seconds(session.ends_at) > 0:
        presence_service.set_offline(session.mentor_id, "mentor")
    db.commit()


@dataclass
class LiveSessionContext:
    session: ChatSession
    booking: Booking | None
    communication_mode: str | None
    room_name: str
    remaining_seconds: int
    can_join: bool
    participant_role: str | None


def resolve_live_session(
    db: Session,
    *,
    chat_session_id: str,
    user_id: str | None,
    mentor_id: str | None,
    activate_on_access: bool = False,
) -> LiveSessionContext:
    """Resolve booking mode, timer, and join eligibility for a chat session participant."""
    from services.chat_service import ChatError, get_session_for_participant

    session = get_session_for_participant(db, chat_session_id, user_id, mentor_id)
    booking = booking_for_chat_session(db, chat_session_id)
    comm_mode = communication_mode_for_session(db, chat_session_id)
    rem = remaining_seconds(session.ends_at)
    room_name = livekit_room_name_for_session(chat_session_id)

    if user_id and session.user_id == user_id:
        role = "user"
    elif mentor_id and session.mentor_id == mentor_id:
        role = "mentor"
    else:
        role = None

    can_join = False
    if session.status != CHAT_SESSION_ENDED and rem > 0:
        if session.status == CHAT_SESSION_ACTIVE:
            can_join = True
        elif session.status == CHAT_SESSION_PAUSED:
            can_join = True
            if activate_on_access:
                activate_session_on_participant_join(db, chat_session_id)
                db.refresh(session)
                can_join = session.status == CHAT_SESSION_ACTIVE and remaining_seconds(session.ends_at) > 0

    return LiveSessionContext(
        session=session,
        booking=booking,
        communication_mode=comm_mode,
        room_name=room_name,
        remaining_seconds=rem,
        can_join=can_join,
        participant_role=role,
    )


def require_active_meeting_access(
    db: Session, session_id: str, user_id: str | None, mentor_id: str | None
) -> ChatSession:
    """Participant must be in session with time remaining; activates paused booking chats."""
    from services.chat_service import ChatError, get_session_for_participant

    session = get_session_for_participant(db, session_id, user_id, mentor_id)
    if session.status == CHAT_SESSION_ENDED:
        raise ChatError("Session has ended", "session_ended")
    if remaining_seconds(session.ends_at) <= 0:
        raise ChatError("Chat time has expired", "time_expired")
    if session.status == CHAT_SESSION_PAUSED:
        activate_session_on_participant_join(db, session_id)
        db.refresh(session)
    if session.status != CHAT_SESSION_ACTIVE:
        raise ChatError("Session is not active", "session_not_active")
    if remaining_seconds(session.ends_at) <= 0:
        raise ChatError("Chat time has expired", "time_expired")
    return session
