import logging

from fastapi import APIRouter, HTTPException, status

from api.deps import ChatActorDep, DbSession
from schemas.meeting import MeetingOut, MeetingTokenOut
from services.chat_service import ChatError
from services.meeting_service import meeting_out_for_session, mint_meeting_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _meeting_http(e: ChatError) -> HTTPException:
    code_map = {
        "session_not_found": status.HTTP_404_NOT_FOUND,
        "forbidden": status.HTTP_403_FORBIDDEN,
        "session_ended": status.HTTP_410_GONE,
        "session_not_active": status.HTTP_400_BAD_REQUEST,
        "time_expired": status.HTTP_400_BAD_REQUEST,
        "livekit_not_configured": status.HTTP_503_SERVICE_UNAVAILABLE,
    }
    st = code_map.get(e.code, status.HTTP_400_BAD_REQUEST)
    return HTTPException(st, detail={"message": e.message, "code": e.code})


def _actor_ids(actor: ChatActorDep) -> tuple[str | None, str | None]:
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    if not uid and not mid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return uid, mid


@router.get("/sessions/{chat_session_id}", response_model=MeetingOut)
def get_meeting_session(
    chat_session_id: str,
    db: DbSession,
    actor: ChatActorDep,
) -> MeetingOut:
    """Meeting metadata for a live session (mode, timer, join eligibility)."""
    uid, mid = _actor_ids(actor)
    try:
        return meeting_out_for_session(
            db,
            chat_session_id=chat_session_id,
            user_id=uid,
            mentor_id=mid,
        )
    except ChatError as e:
        raise _meeting_http(e) from e


@router.post("/sessions/{chat_session_id}/token", response_model=MeetingTokenOut)
def post_meeting_token(
    chat_session_id: str,
    db: DbSession,
    actor: ChatActorDep,
) -> MeetingTokenOut:
    """Mint a LiveKit JWT for WebRTC in this live session."""
    uid, mid = _actor_ids(actor)
    display_name = actor.user.full_name if actor.user else actor.mentor.full_name
    try:
        return mint_meeting_token(
            db,
            chat_session_id=chat_session_id,
            user_id=uid,
            mentor_id=mid,
            display_name=display_name,
        )
    except ChatError as e:
        raise _meeting_http(e) from e
