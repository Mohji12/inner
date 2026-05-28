"""WebRTC meeting (LiveKit) operations — separate from chat messaging."""

from core.config import settings
from schemas.meeting import MeetingOut, MeetingTokenOut
from services.chat_service import ChatError
from services.live_session_service import (
    require_active_meeting_access,
    resolve_live_session,
    session_remaining_seconds,
)
from services.livekit_call_token import livekit_room_name_for_session, mint_livekit_join_token


def meeting_out_for_session(
    db,
    *,
    chat_session_id: str,
    user_id: str | None,
    mentor_id: str | None,
) -> MeetingOut:
    ctx = resolve_live_session(
        db,
        chat_session_id=chat_session_id,
        user_id=user_id,
        mentor_id=mentor_id,
        activate_on_access=False,
    )
    return MeetingOut(
        chat_session_id=chat_session_id,
        room_name=ctx.room_name,
        communication_mode=ctx.communication_mode,
        status=ctx.session.status,
        ends_at=ctx.session.ends_at,
        remaining_seconds=ctx.remaining_seconds,
        can_join=ctx.can_join,
        timer_started=ctx.timer_started,
        waiting_for=ctx.waiting_for,
        allocated_duration_minutes=ctx.allocated_duration_minutes,
    )


def mint_meeting_token(
    db,
    *,
    chat_session_id: str,
    user_id: str | None,
    mentor_id: str | None,
    display_name: str,
) -> MeetingTokenOut:
    if not settings.livekit_url or not settings.livekit_api_key or not settings.livekit_api_secret:
        raise ChatError(
            "Voice calls are not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.",
            "livekit_not_configured",
        )

    session = require_active_meeting_access(db, chat_session_id, user_id, mentor_id)
    rem = session_remaining_seconds(session)
    room_name = livekit_room_name_for_session(chat_session_id)

    if user_id:
        identity = f"user_{user_id}"
    else:
        identity = f"mentor_{mentor_id}"

    token = mint_livekit_join_token(
        room_name=room_name,
        identity=identity,
        display_name=display_name,
        ttl_seconds=rem,
    )
    return MeetingTokenOut(
        provider="livekit",
        url=settings.livekit_url.strip(),
        token=token,
        room_name=room_name,
        expires_in_seconds=min(rem + 120, 86400),
    )
