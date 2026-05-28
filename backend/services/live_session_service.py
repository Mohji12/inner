"""Shared live-session context for chat messaging and WebRTC meetings."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

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
BOOKING_JOIN_DEADLINE_MINUTES = 30

WaitingFor = Literal["user", "mentor", "both"] | None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def remaining_seconds(ends_at: datetime) -> int:
    now = _utcnow()
    ends_at = _ensure_utc(ends_at)
    delta = (ends_at - now).total_seconds()
    return max(0, int(delta))


def is_booking_session(session: ChatSession) -> bool:
    return session.allocated_duration_minutes is not None


def timer_started(session: ChatSession) -> bool:
    return session.timer_started_at is not None


def join_deadline_expired(session: ChatSession) -> bool:
    """Before both join, ends_at holds the join deadline."""
    if not is_booking_session(session) or timer_started(session):
        return False
    return remaining_seconds(session.ends_at) <= 0


def session_remaining_seconds(session: ChatSession) -> int:
    """Remaining billed session time (or join deadline before timer starts)."""
    if session.status == CHAT_SESSION_ENDED:
        return 0
    if is_booking_session(session) and not timer_started(session):
        if join_deadline_expired(session):
            return 0
        allocated = max(1, int(session.allocated_duration_minutes or 1))
        return allocated * 60
    return remaining_seconds(session.ends_at)


def waiting_for_participant(session: ChatSession) -> WaitingFor:
    if not is_booking_session(session) or timer_started(session) or join_deadline_expired(session):
        return None
    user_in = session.user_joined_at is not None
    mentor_in = session.mentor_joined_at is not None
    if not user_in and not mentor_in:
        return "both"
    if not user_in:
        return "user"
    if not mentor_in:
        return "mentor"
    return None


def session_allows_messaging(session: ChatSession) -> bool:
    if session.status == CHAT_SESSION_ENDED:
        return False
    if join_deadline_expired(session):
        return False
    if session.status == CHAT_SESSION_ACTIVE:
        return session_remaining_seconds(session) > 0
    if is_booking_session(session) and not timer_started(session):
        return not join_deadline_expired(session)
    return False


def booking_for_chat_session(db: Session, session_id: str) -> Booking | None:
    needle = f"/chat/{session_id}"
    return (
        db.query(Booking)
        .filter(Booking.meeting_link.isnot(None), Booking.meeting_link.contains(needle))
        .order_by(Booking.created_at.desc())
        .first()
    )


def session_booking_meta(db: Session, session_id: str) -> dict | None:
    booking = booking_for_chat_session(db, session_id)
    if not booking:
        return None
    return {
        "booking_id": booking.id,
        "duration_minutes": int(booking.duration),
        "booked_at": booking.created_at,
        "start_at_utc": booking.start_at_utc,
        "end_at_utc": booking.end_at_utc,
        "communication_mode": booking.communication_mode,
    }


def communication_mode_for_session(db: Session, session_id: str) -> str | None:
    """Return booking communication mode (video/call) when chat was created from a paid booking."""
    booking = booking_for_chat_session(db, session_id)
    if not booking or not booking.communication_mode:
        return None
    mode = booking.communication_mode.strip().lower()
    return mode if mode in BOOKING_COMM_MODES else None


def sync_session_time_state(session: ChatSession) -> None:
    """If billed time expired while still marked active, move to paused (lazy transition)."""
    if session.status != CHAT_SESSION_ACTIVE:
        return
    if is_booking_session(session) and not timer_started(session):
        return
    if session_remaining_seconds(session) <= 0:
        session.status = CHAT_SESSION_PAUSED
        session.updated_at = _utcnow()


def record_participant_join(db: Session, session_id: str, role: str) -> bool:
    """
    Record user/mentor presence. For booking sessions, start the billed timer when both have joined.
    Returns True when the session timer was just started.
    """
    session = db.query(ChatSession).filter(ChatSession.id == session_id).with_for_update().first()
    if not session:
        return False
    if session.status == CHAT_SESSION_ENDED:
        db.commit()
        return False
    if join_deadline_expired(session):
        db.commit()
        return False

    now = _utcnow()
    timer_just_started = False

    if role == "user" and not session.user_joined_at:
        session.user_joined_at = now
    elif role == "mentor" and not session.mentor_joined_at:
        session.mentor_joined_at = now

    if (
        is_booking_session(session)
        and not timer_started(session)
        and session.user_joined_at
        and session.mentor_joined_at
    ):
        allocated = max(1, int(session.allocated_duration_minutes or 1))
        session.timer_started_at = now
        session.ends_at = now + timedelta(minutes=allocated)
        session.status = CHAT_SESSION_ACTIVE
        timer_just_started = True
    elif not is_booking_session(session):
        if session.status == CHAT_SESSION_PAUSED and session_remaining_seconds(session) > 0:
            session.status = CHAT_SESSION_ACTIVE
    elif session.status == CHAT_SESSION_PAUSED and timer_started(session) and session_remaining_seconds(session) > 0:
        session.status = CHAT_SESSION_ACTIVE

    session.updated_at = now
    if (
        timer_started(session)
        and session.status == CHAT_SESSION_ACTIVE
        and session_remaining_seconds(session) > 0
    ):
        presence_service.set_offline(session.mentor_id, "mentor")
    db.commit()
    return timer_just_started


def activate_session_on_participant_join(db: Session, session_id: str, role: str = "user") -> bool:
    """Backward-compatible alias — prefer record_participant_join with explicit role."""
    return record_participant_join(db, session_id, role)


@dataclass
class LiveSessionContext:
    session: ChatSession
    booking: Booking | None
    communication_mode: str | None
    room_name: str
    remaining_seconds: int
    can_join: bool
    participant_role: str | None
    timer_started: bool
    waiting_for: WaitingFor
    allocated_duration_minutes: int | None


def resolve_live_session(
    db: Session,
    *,
    chat_session_id: str,
    user_id: str | None,
    mentor_id: str | None,
    activate_on_access: bool = False,
    participant_role: str | None = None,
) -> LiveSessionContext:
    """Resolve booking mode, timer, and join eligibility for a chat session participant."""
    from services.chat_service import get_session_for_participant

    session = get_session_for_participant(db, chat_session_id, user_id, mentor_id)
    booking = booking_for_chat_session(db, chat_session_id)
    comm_mode = communication_mode_for_session(db, chat_session_id)
    rem = session_remaining_seconds(session)
    room_name = livekit_room_name_for_session(chat_session_id)

    if user_id and session.user_id == user_id:
        role = "user"
    elif mentor_id and session.mentor_id == mentor_id:
        role = "mentor"
    else:
        role = None

    if activate_on_access and role:
        record_participant_join(db, chat_session_id, role)
        db.refresh(session)
        rem = session_remaining_seconds(session)

    can_join = False
    if session.status != CHAT_SESSION_ENDED and not join_deadline_expired(session):
        if timer_started(session) or not is_booking_session(session):
            can_join = rem > 0 and session.status in (CHAT_SESSION_ACTIVE, CHAT_SESSION_PAUSED)
        else:
            can_join = rem > 0

    return LiveSessionContext(
        session=session,
        booking=booking,
        communication_mode=comm_mode,
        room_name=room_name,
        remaining_seconds=rem,
        can_join=can_join,
        participant_role=participant_role or role,
        timer_started=timer_started(session),
        waiting_for=waiting_for_participant(session),
        allocated_duration_minutes=session.allocated_duration_minutes,
    )


def require_active_meeting_access(
    db: Session, session_id: str, user_id: str | None, mentor_id: str | None
) -> ChatSession:
    """Participant must be in session with time remaining; records join for booking dual-start timer."""
    from services.chat_service import ChatError, get_session_for_participant

    session = get_session_for_participant(db, session_id, user_id, mentor_id)
    if session.status == CHAT_SESSION_ENDED:
        raise ChatError("Session has ended", "session_ended")
    if join_deadline_expired(session):
        raise ChatError("Join window has expired", "time_expired")
    if not is_booking_session(session) and session_remaining_seconds(session) <= 0:
        raise ChatError("Chat time has expired", "time_expired")

    role = "user" if user_id else "mentor"
    record_participant_join(db, session_id, role)
    db.refresh(session)

    if timer_started(session) and session_remaining_seconds(session) <= 0:
        raise ChatError("Chat time has expired", "time_expired")
    if not is_booking_session(session) and session.status != CHAT_SESSION_ACTIVE:
        raise ChatError("Session is not active", "session_not_active")
    return session
