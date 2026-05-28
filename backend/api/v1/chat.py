import logging
from datetime import timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.deps import AnyActorDep, ChatActorDep, CurrentMentor, CurrentUser, DbSession, RequestLang
from api.v1.file_upload import _read_image_upload, store_chat_image
from core.limiter import limiter
from models.chat_message import ChatMessage
from models.chat_bridge_session import ChatBridgeSession
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.mentor import Mentor
from models.user import User
from core.security import new_uuid
from core.chat_states import CHAT_SENDER_MENTOR, CHAT_SENDER_USER
from core.config import settings
from schemas.chat import (
    ChatCallTokenOut,
    ChatDialOutOut,
    ChatInvoiceConversationLineOut,
    ChatInvoiceDetailOut,
    ChatInvoiceLineOut,
    ChatInvoiceSummaryOut,
    ChatMessageIn,
    ChatMessageOut,
    ChatSessionExtendIn,
    ChatSessionExtendQuoteOut,
    ChatSessionOut,
    ChatSessionCheckoutOut,
    ChatSessionStartIn,
    ChatInboxOut,
    ChatInboxSessionOut,
    ChatPhoneBridgeIn,
    ChatPhoneBridgeLegOut,
    ChatPhoneBridgeOut,
)
from services.chat_service import (
    ChatError,
    end_session,
    extend_session_checkout,
    quote_session_extension,
    get_active_session_for_mentor,
    get_session_for_participant,
    hydrate_sessions_for_list,
    list_all_messages_for_session,
    list_messages,
    list_sessions_for_participant,
    mark_session_as_read,
    post_message,
    require_session_for_voice_call,
    start_session_checkout,
)
from services.live_session_service import (
    record_participant_join,
    session_booking_meta,
    session_remaining_seconds,
    timer_started as session_timer_started,
    waiting_for_participant,
)
from livekit.api import TwirpError

from services.meeting_service import mint_meeting_token
from services.livekit_call_token import livekit_room_name_for_session
from services.livekit_phone_dial import dial_phone_into_chat_room, normalize_phone_e164
from services.phone_bridge_service import bridge_room_name, validate_bridge_numbers
from services.fx_checkout import FxCheckoutError, FxUpstreamError
from services.mollie_service import resolve_mollie_webhook_url
from services.chat_hub import chat_hub
from services.chat_invoice_pdf import build_chat_invoice_pdf
from services.chat_invoice_service import (
    aggregate_purchases,
    invoice_payment_status,
    get_mentor_chat_invoice_detail,
    get_user_chat_invoice_detail,
    list_mentor_chat_invoice_sessions,
    list_user_chat_invoice_sessions,
)
from services.i18n_service import resolve_i18n_text, to_i18n_map
from db.session import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])
INSTANT_SESSION_MINUTES = 5


class InstantSessionStartIn(BaseModel):
    mentor_id: str
    checkout_currency: str | None = None


def _invoice_number(session_id: str) -> str:
    return f"CHAT-{session_id[:8].upper()}"


def _session_wall_duration_seconds(session) -> int:
    ca = session.created_at
    ua = session.updated_at
    if ca.tzinfo is None:
        ca = ca.replace(tzinfo=timezone.utc)
    if ua.tzinfo is None:
        ua = ua.replace(tzinfo=timezone.utc)
    return max(0, int((ua - ca).total_seconds()))


async def _ws_push_session(session_id: str, session) -> None:
    payload = _session_out(session).model_dump(mode="json")
    await chat_hub.broadcast(session_id, {"type": "session", "data": payload})


async def _ws_push_message(session_id: str, msg) -> None:
    db = SessionLocal()
    try:
        user, mentor = _session_participants(db, session_id)
        out = _chat_message_out(msg, "en", user=user, mentor=mentor)
        await chat_hub.broadcast(session_id, {"type": "new_message", "data": out.model_dump(mode="json")})
    finally:
        db.close()


def _session_participants(db: Session, session_id: str) -> tuple[User | None, Mentor | None]:
    sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not sess:
        return None, None
    user = db.query(User).filter(User.id == sess.user_id).first()
    mentor = db.query(Mentor).filter(Mentor.id == sess.mentor_id).first()
    return user, mentor


def _sender_display_name(msg: ChatMessage, user: User | None, mentor: Mentor | None) -> str:
    if msg.sender_role == CHAT_SENDER_USER:
        return (user.full_name if user and user.full_name else "User").strip()
    if msg.sender_role == CHAT_SENDER_MENTOR:
        return (mentor.full_name if mentor and mentor.full_name else "Coach").strip()
    return msg.sender_role or "Participant"


def _message_preview(body: str | None, attachment_url: str | None) -> str | None:
    text = (body or "").strip()
    if text:
        return text
    if attachment_url:
        return "[Image]"
    return None


def _chat_message_out(
    msg: ChatMessage,
    lang: str,
    *,
    user: User | None = None,
    mentor: Mentor | None = None,
) -> ChatMessageOut:
    data = ChatMessageOut.model_validate(msg).model_dump()
    data["body"] = resolve_i18n_text(getattr(msg, "body_i18n", None), msg.body, lang)
    data["sender_display_name"] = _sender_display_name(msg, user, mentor)
    return ChatMessageOut.model_validate(data)


def _chat_http(e: ChatError) -> HTTPException:
    code_map = {
        "mentor_busy": status.HTTP_409_CONFLICT,
        "session_not_found": status.HTTP_404_NOT_FOUND,
        "forbidden": status.HTTP_403_FORBIDDEN,
        "session_ended": status.HTTP_410_GONE,
        "session_not_active": status.HTTP_400_BAD_REQUEST,
        "time_expired": status.HTTP_400_BAD_REQUEST,
        "chat_disabled": status.HTTP_400_BAD_REQUEST,
        "mentor_inactive": status.HTTP_400_BAD_REQUEST,
        "email_not_verified": status.HTTP_403_FORBIDDEN,
        "below_min_minutes": status.HTTP_400_BAD_REQUEST,
        "mentor_offline": status.HTTP_409_CONFLICT,
        "livekit_not_configured": status.HTTP_503_SERVICE_UNAVAILABLE,
    }
    st = code_map.get(e.code, status.HTTP_400_BAD_REQUEST)
    return HTTPException(st, detail={"message": e.message, "code": e.code})


@router.post("/instant-sessions/start", response_model=ChatSessionCheckoutOut, status_code=status.HTTP_201_CREATED)
def start_instant_session(
    db: DbSession,
    me: CurrentUser,
    payload: InstantSessionStartIn,
    background_tasks: BackgroundTasks,
    request: Request,
) -> ChatSessionCheckoutOut:
    try:
        session, checkout_url, mollie_pid = start_session_checkout(
            db,
            user_id=me.id,
            mentor_id=payload.mentor_id,
            minutes=INSTANT_SESSION_MINUTES,
            checkout_currency=(payload.checkout_currency or "EUR").strip(),
            redirect_url=f"{settings.mollie_redirect_base_url.rstrip('/')}/user/appointments?sessionId={{session_id}}",
            webhook_url=resolve_mollie_webhook_url(request),
        )
    except FxCheckoutError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except FxUpstreamError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
    except ChatError as e:
        raise _chat_http(e) from e
    background_tasks.add_task(_ws_push_session, session.id, session)
    return ChatSessionCheckoutOut(
        session=_session_out(session), checkout_url=checkout_url, mollie_payment_id=mollie_pid
    )


def _session_out(session, db: Session | None = None) -> ChatSessionOut:
    booking = None
    if db is not None:
        meta = session_booking_meta(db, session.id)
        if meta:
            from schemas.chat import SessionBookingMetaOut

            booking = SessionBookingMetaOut.model_validate(meta)
    return ChatSessionOut(
        id=session.id,
        user_id=session.user_id,
        mentor_id=session.mentor_id,
        status=session.status,
        ends_at=session.ends_at,
        remaining_seconds=session_remaining_seconds(session),
        timer_started=session_timer_started(session),
        waiting_for=waiting_for_participant(session),
        allocated_duration_minutes=session.allocated_duration_minutes,
        partner_is_online=None,
        booking=booking,
        created_at=session.created_at,
        updated_at=session.updated_at,
        last_message_at=session.last_message_at,
        unread_count_user=session.unread_count_user,
        unread_count_mentor=session.unread_count_mentor,
    )


@router.post("/sessions", response_model=ChatSessionCheckoutOut, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    db: DbSession,
    me: CurrentUser,
    payload: ChatSessionStartIn,
    background_tasks: BackgroundTasks,
    request: Request,
) -> ChatSessionCheckoutOut:
    try:
        session, checkout_url, mollie_pid = start_session_checkout(
            db,
            user_id=me.id,
            mentor_id=payload.mentor_id,
            minutes=payload.minutes,
            checkout_currency=(payload.checkout_currency or "EUR").strip(),
            redirect_url=f"{settings.mollie_redirect_base_url.rstrip('/')}/user/appointments?sessionId={{session_id}}",
            webhook_url=resolve_mollie_webhook_url(request),
        )
    except FxCheckoutError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except FxUpstreamError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
    except ChatError as e:
        raise _chat_http(e) from e
    background_tasks.add_task(_ws_push_session, session.id, session)
    return ChatSessionCheckoutOut(
        session=_session_out(session), checkout_url=checkout_url, mollie_payment_id=mollie_pid
    )


@router.get("/sessions/{session_id}/extend/quote", response_model=ChatSessionExtendQuoteOut)
def get_chat_session_extend_quote(
    session_id: str,
    db: DbSession,
    me: CurrentUser,
    minutes: int = Query(default=5, ge=1, le=480),
    checkout_currency: str = Query(default="EUR"),
) -> ChatSessionExtendQuoteOut:
    try:
        data = quote_session_extension(
            db,
            session_id=session_id,
            user_id=me.id,
            minutes=minutes,
            checkout_currency=(checkout_currency or "EUR").strip(),
        )
    except FxCheckoutError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except FxUpstreamError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
    except ChatError as e:
        raise _chat_http(e) from e
    return ChatSessionExtendQuoteOut.model_validate(data)


@router.post("/sessions/{session_id}/extend", response_model=ChatSessionCheckoutOut)
def extend_chat_session(
    session_id: str,
    db: DbSession,
    me: CurrentUser,
    payload: ChatSessionExtendIn,
    background_tasks: BackgroundTasks,
    request: Request,
) -> ChatSessionCheckoutOut:
    try:
        session, checkout_url, mollie_pid = extend_session_checkout(
            db,
            session_id=session_id,
            user_id=me.id,
            minutes=payload.minutes,
            checkout_currency=(payload.checkout_currency or "EUR").strip(),
            redirect_url=f"{settings.mollie_redirect_base_url.rstrip('/')}/user/chat/{session_id}",
            webhook_url=resolve_mollie_webhook_url(request),
        )
    except FxCheckoutError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except FxUpstreamError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
    except ChatError as e:
        raise _chat_http(e) from e
    background_tasks.add_task(_ws_push_session, session_id, session)
    return ChatSessionCheckoutOut(
        session=_session_out(session), checkout_url=checkout_url, mollie_payment_id=mollie_pid
    )


@router.get("/sessions/{session_id}", response_model=ChatSessionOut)
def get_chat_session(session_id: str, db: DbSession, actor: ChatActorDep) -> ChatSessionOut:
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    try:
        session = get_session_for_participant(db, session_id, uid, mid)
    except ChatError as e:
        raise _chat_http(e) from e
    from services.chat_service import mentor_chat_busy
    from services.presence_service import presence_service

    if actor.user:
        partner_online = presence_service.is_online(session.mentor_id, "mentor") and not mentor_chat_busy(db, session.mentor_id)
    else:
        partner_online = presence_service.is_online(session.user_id, "user")
    out = _session_out(session, db)
    out.partner_is_online = partner_online
    return out


@router.post("/sessions/{session_id}/join", response_model=ChatSessionOut)
def join_chat_session(
    session_id: str,
    db: DbSession,
    actor: ChatActorDep,
    background_tasks: BackgroundTasks,
) -> ChatSessionOut:
    """Record that the participant entered the room; starts billed timer when both user and coach have joined."""
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    try:
        get_session_for_participant(db, session_id, uid, mid)
    except ChatError as e:
        raise _chat_http(e) from e

    role = "user" if actor.user else "mentor"
    timer_just_started = record_participant_join(db, session_id, role)
    session = get_session_for_participant(db, session_id, uid, mid)
    if timer_just_started:
        background_tasks.add_task(_ws_push_session, session_id, session)

    from services.chat_service import mentor_chat_busy
    from services.presence_service import presence_service

    if actor.user:
        partner_online = presence_service.is_online(session.mentor_id, "mentor") and not mentor_chat_busy(db, session.mentor_id)
    else:
        partner_online = presence_service.is_online(session.user_id, "user")
    out = _session_out(session, db)
    out.partner_is_online = partner_online
    return out


@router.post(
    "/sessions/{session_id}/call/token",
    response_model=ChatCallTokenOut,
    deprecated=True,
    summary="[Deprecated] Use POST /meetings/sessions/{id}/token",
)
def post_chat_call_token(
    session_id: str,
    db: DbSession,
    actor: ChatActorDep,
) -> ChatCallTokenOut:
    """Deprecated alias — delegates to the meetings API."""
    logger.warning(
        "POST /chat/sessions/%s/call/token is deprecated; use POST /meetings/sessions/{id}/token",
        session_id,
    )
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    if not uid and not mid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    display_name = actor.user.full_name if actor.user else actor.mentor.full_name
    try:
        token_out = mint_meeting_token(
            db,
            chat_session_id=session_id,
            user_id=uid,
            mentor_id=mid,
            display_name=display_name,
        )
    except ChatError as e:
        raise _chat_http(e) from e
    return ChatCallTokenOut(
        provider=token_out.provider,
        url=token_out.url,
        token=token_out.token,
        room_name=token_out.room_name,
        expires_in_seconds=token_out.expires_in_seconds,
    )


@router.post(
    "/sessions/{session_id}/call/dial",
    response_model=ChatDialOutOut,
    deprecated=True,
    summary="[Deprecated] Prefer in-app meetings via POST /meetings/sessions/{id}/token",
)
async def post_chat_call_dial_peer_phone(
    session_id: str,
    db: DbSession,
    actor: ChatActorDep,
) -> ChatDialOutOut:
    """Place an outbound PSTN call to the *other* participant's profile phone via LiveKit SIP (joins the same room as WebRTC)."""
    if (
        not settings.livekit_url
        or not settings.livekit_api_key
        or not settings.livekit_api_secret
        or not (settings.livekit_sip_outbound_trunk_id or "").strip()
    ):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Phone dial-out is not configured. Set LIVEKIT_* and LIVEKIT_SIP_OUTBOUND_TRUNK_ID, "
            "and configure an outbound SIP trunk in LiveKit Cloud.",
        )
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    if not uid and not mid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        chat_session = require_session_for_voice_call(db, session_id, uid, mid)
    except ChatError as e:
        raise _chat_http(e) from e

    if uid:
        peer = db.query(Mentor).filter(Mentor.id == chat_session.mentor_id).first()
        peer_label = "coach"
        phone_raw = peer.phone_number if peer else None
        peer_name = peer.full_name if peer else "Coach"
        sip_identity = f"sip_mentor_{chat_session.mentor_id}"
    else:
        peer = db.query(User).filter(User.id == chat_session.user_id).first()
        peer_label = "user"
        phone_raw = peer.phone_number if peer else None
        peer_name = peer.full_name if peer else "User"
        sip_identity = f"sip_user_{chat_session.user_id}"

    phone_e164 = normalize_phone_e164(phone_raw)
    if not phone_e164:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"The other participant ({peer_label}) has no valid E.164 phone on file (use +country… in profile).",
        )

    room_name = livekit_room_name_for_session(session_id)
    trunk_id = settings.livekit_sip_outbound_trunk_id.strip()
    try:
        info = await dial_phone_into_chat_room(
            room_name=room_name,
            phone_e164=phone_e164,
            participant_identity=sip_identity,
            participant_name=peer_name,
            sip_trunk_id=trunk_id,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    except TwirpError as e:
        detail = f"LiveKit SIP error [{e.code}] HTTP {e.status}: {e.message}"
        logger.warning("POST /call/dial failed: %s", detail)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail) from e
    except Exception as e:
        logger.exception("POST /call/dial unexpected error")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Phone dial failed: {e!s}",
        ) from e

    return ChatDialOutOut(
        participant_id=info.participant_id,
        participant_identity=info.participant_identity,
        room_name=info.room_name,
        sip_call_id=info.sip_call_id or "",
        dialed_phone_e164=phone_e164,
    )


@router.post(
    "/call/bridge",
    response_model=ChatPhoneBridgeOut,
    status_code=status.HTTP_201_CREATED,
    deprecated=True,
    summary="[Deprecated] Standalone phone bridge — not used for booked live sessions",
)
@limiter.limit("5/minute")
async def post_chat_call_bridge(
    request,
    payload: ChatPhoneBridgeIn,
    db: DbSession,
    actor: AnyActorDep,
) -> ChatPhoneBridgeOut:
    if (
        not settings.livekit_url
        or not settings.livekit_api_key
        or not settings.livekit_api_secret
        or not (settings.livekit_sip_outbound_trunk_id or "").strip()
    ):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Phone dial-out is not configured. Set LIVEKIT_* and LIVEKIT_SIP_OUTBOUND_TRUNK_ID, "
            "and configure an outbound SIP trunk in LiveKit Cloud.",
        )

    try:
        number_a, number_b = validate_bridge_numbers(payload.number_a, payload.number_b)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    bridge_id = new_uuid()
    room_name = bridge_room_name(bridge_id)
    trunk_id = settings.livekit_sip_outbound_trunk_id.strip()
    bridge = ChatBridgeSession(
        id=bridge_id,
        actor_role=actor.role,
        actor_id=actor.subject_id,
        number_a=number_a,
        number_b=number_b,
        label_a=(payload.label_a or "").strip() or None,
        label_b=(payload.label_b or "").strip() or None,
        room_name=room_name,
        status="dialing",
        leg_a_participant_id=None,
        leg_a_sip_call_id=None,
        leg_b_participant_id=None,
        leg_b_sip_call_id=None,
        error_message=None,
    )
    db.add(bridge)
    db.flush()

    leg_a_identity = f"sip_a_{bridge_id}"
    leg_b_identity = f"sip_b_{bridge_id}"
    leg_a_label = bridge.label_a or "Participant A"
    leg_b_label = bridge.label_b or "Participant B"

    try:
        leg_a_info = await dial_phone_into_chat_room(
            room_name=room_name,
            phone_e164=number_a,
            participant_identity=leg_a_identity,
            participant_name=leg_a_label,
            sip_trunk_id=trunk_id,
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    except TwirpError as e:
        db.rollback()
        detail = f"LiveKit SIP error [{e.code}] HTTP {e.status}: {e.message}"
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail) from e
    except Exception as e:
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Phone dial failed: {e!s}") from e

    bridge.leg_a_participant_id = leg_a_info.participant_id
    bridge.leg_a_sip_call_id = leg_a_info.sip_call_id or None

    try:
        leg_b_info = await dial_phone_into_chat_room(
            room_name=room_name,
            phone_e164=number_b,
            participant_identity=leg_b_identity,
            participant_name=leg_b_label,
            sip_trunk_id=trunk_id,
        )
    except ValueError as e:
        bridge.status = "partial_failed"
        bridge.error_message = str(e)
        db.commit()
        return ChatPhoneBridgeOut(
            bridge_session_id=bridge.id,
            room_name=room_name,
            status=bridge.status,
            actor_role=actor.role,
            leg_a=ChatPhoneBridgeLegOut(
                participant_id=leg_a_info.participant_id,
                participant_identity=leg_a_info.participant_identity,
                sip_call_id=leg_a_info.sip_call_id or None,
                dialed_phone_e164=number_a,
                status="connected",
                error=None,
            ),
            leg_b=ChatPhoneBridgeLegOut(
                participant_id=None,
                participant_identity=leg_b_identity,
                sip_call_id=None,
                dialed_phone_e164=number_b,
                status="failed",
                error=str(e),
            ),
            error_hint="Leg A is already in the room. Retry leg B or end leg A manually in LiveKit console.",
        )
    except TwirpError as e:
        detail = f"LiveKit SIP error [{e.code}] HTTP {e.status}: {e.message}"
        bridge.status = "partial_failed"
        bridge.error_message = detail
        db.commit()
        return ChatPhoneBridgeOut(
            bridge_session_id=bridge.id,
            room_name=room_name,
            status=bridge.status,
            actor_role=actor.role,
            leg_a=ChatPhoneBridgeLegOut(
                participant_id=leg_a_info.participant_id,
                participant_identity=leg_a_info.participant_identity,
                sip_call_id=leg_a_info.sip_call_id or None,
                dialed_phone_e164=number_a,
                status="connected",
                error=None,
            ),
            leg_b=ChatPhoneBridgeLegOut(
                participant_id=None,
                participant_identity=leg_b_identity,
                sip_call_id=None,
                dialed_phone_e164=number_b,
                status="failed",
                error=detail,
            ),
            error_hint="Leg A is already in the room. Retry leg B or end leg A manually in LiveKit console.",
        )
    except Exception as e:
        detail = f"Phone dial failed: {e!s}"
        bridge.status = "partial_failed"
        bridge.error_message = detail
        db.commit()
        return ChatPhoneBridgeOut(
            bridge_session_id=bridge.id,
            room_name=room_name,
            status=bridge.status,
            actor_role=actor.role,
            leg_a=ChatPhoneBridgeLegOut(
                participant_id=leg_a_info.participant_id,
                participant_identity=leg_a_info.participant_identity,
                sip_call_id=leg_a_info.sip_call_id or None,
                dialed_phone_e164=number_a,
                status="connected",
                error=None,
            ),
            leg_b=ChatPhoneBridgeLegOut(
                participant_id=None,
                participant_identity=leg_b_identity,
                sip_call_id=None,
                dialed_phone_e164=number_b,
                status="failed",
                error=detail,
            ),
            error_hint="Leg A is already in the room. Retry leg B or end leg A manually in LiveKit console.",
        )

    bridge.leg_b_participant_id = leg_b_info.participant_id
    bridge.leg_b_sip_call_id = leg_b_info.sip_call_id or None
    bridge.status = "connected"
    bridge.error_message = None
    db.commit()

    return ChatPhoneBridgeOut(
        bridge_session_id=bridge.id,
        room_name=room_name,
        status=bridge.status,
        actor_role=actor.role,
        leg_a=ChatPhoneBridgeLegOut(
            participant_id=leg_a_info.participant_id,
            participant_identity=leg_a_info.participant_identity,
            sip_call_id=leg_a_info.sip_call_id or None,
            dialed_phone_e164=number_a,
            status="connected",
            error=None,
        ),
        leg_b=ChatPhoneBridgeLegOut(
            participant_id=leg_b_info.participant_id,
            participant_identity=leg_b_info.participant_identity,
            sip_call_id=leg_b_info.sip_call_id or None,
            dialed_phone_e164=number_b,
            status="connected",
            error=None,
        ),
        error_hint=None,
    )


@router.get("/sessions", response_model=ChatInboxOut)
def list_my_chat_sessions(db: DbSession, actor: ChatActorDep) -> ChatInboxOut:
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    
    sessions = list_sessions_for_participant(db, user_id=uid, mentor_id=mid)
    hydrate_sessions_for_list(db, sessions)
    out: list[ChatInboxSessionOut] = []
    
    for s in sessions:
        # Get partner info
        from services.chat_service import mentor_chat_busy
        from services.presence_service import presence_service

        if actor.user:
            partner = db.query(Mentor.full_name, Mentor.profile_image).filter(Mentor.id == s.mentor_id).first()
            partner_online = presence_service.is_online(s.mentor_id, "mentor") and not mentor_chat_busy(db, s.mentor_id)
        else:
            partner = db.query(User.full_name, User.profile_image).filter(User.id == s.user_id).first()
            partner_online = presence_service.is_online(s.user_id, "user")
            
        # Get last message preview
        last_msg = (
            db.query(ChatMessage.body, ChatMessage.sender_role, ChatMessage.attachment_url)
            .filter(ChatMessage.session_id == s.id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )

        base = _session_out(s, db)
        out.append(
            ChatInboxSessionOut(
                **base.model_dump(exclude={"partner_is_online"}),
                partner_name=partner[0] if partner else "Unknown",
                partner_profile_image=partner[1] if partner else None,
                partner_is_online=partner_online,
                last_message_body=_message_preview(
                    last_msg[0] if last_msg else None,
                    last_msg[2] if last_msg else None,
                ),
                last_message_role=last_msg[1] if last_msg else None,
            )
        )
        
    return ChatInboxOut(sessions=out)


@router.post("/sessions/{session_id}/read", response_model=ChatSessionOut)
async def post_mark_session_read(
    session_id: str,
    db: DbSession,
    actor: ChatActorDep,
    background_tasks: BackgroundTasks,
) -> ChatSessionOut:
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    role = "user" if actor.user else "mentor"
    
    try:
        session = get_session_for_participant(db, session_id, uid, mid)
    except ChatError as e:
        raise _chat_http(e) from e
        
    mark_session_as_read(db, session_id=session_id, role=role)
    
    # Broadcast read receipt
    background_tasks.add_task(
        chat_hub.broadcast, 
        session_id, 
        {
            "type": "read_receipt", 
            "data": {"session_id": session_id, "role": role}
        }
    )
    
    return _session_out(session, db)


@router.post("/sessions/{session_id}/messages", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED)
def send_chat_message(
    session_id: str,
    db: DbSession,
    actor: ChatActorDep,
    payload: ChatMessageIn,
    background_tasks: BackgroundTasks,
    lang: RequestLang,
) -> ChatMessageOut:
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    if not uid and not mid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        text = resolve_i18n_text(payload.body_i18n, payload.body, lang) or payload.body
        if not (text or "").strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"message": "Message body is required", "code": "empty_body"})
        msg = post_message(
            db,
            session_id=session_id,
            sender_user_id=uid,
            sender_mentor_id=mid,
            body=text,
        )
        if payload.body_i18n:
            msg.body_i18n = payload.body_i18n
        elif not getattr(msg, "body_i18n", None):
            msg.body_i18n = to_i18n_map(payload.body, lang)
        db.commit()
        db.refresh(msg)
    except ChatError as e:
        raise _chat_http(e) from e
    background_tasks.add_task(_ws_push_message, session_id, msg)
    user, mentor = _session_participants(db, session_id)
    return _chat_message_out(msg, lang, user=user, mentor=mentor)


@router.post(
    "/sessions/{session_id}/messages/image",
    response_model=ChatMessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_chat_image_message(
    session_id: str,
    db: DbSession,
    actor: ChatActorDep,
    background_tasks: BackgroundTasks,
    lang: RequestLang,
    file: UploadFile = File(...),
    body: str = Form(default=""),
) -> ChatMessageOut:
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    if not uid and not mid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    contents = await _read_image_upload(file)
    file_url = store_chat_image(
        contents,
        session_id=session_id,
        original_name=file.filename or "image.png",
    )
    caption = (body or "").strip()
    try:
        msg = post_message(
            db,
            session_id=session_id,
            sender_user_id=uid,
            sender_mentor_id=mid,
            body=caption,
            attachment_url=file_url,
            attachment_type=file.content_type or "image/jpeg",
            attachment_filename=file.filename,
            attachment_size_bytes=len(contents),
        )
        if caption:
            msg.body_i18n = to_i18n_map(caption, lang)
            db.commit()
            db.refresh(msg)
    except ChatError as e:
        raise _chat_http(e) from e
    background_tasks.add_task(_ws_push_message, session_id, msg)
    user, mentor = _session_participants(db, session_id)
    return _chat_message_out(msg, lang, user=user, mentor=mentor)


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
def get_chat_messages(
    session_id: str,
    db: DbSession,
    actor: ChatActorDep,
    lang: RequestLang,
    since_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[ChatMessageOut]:
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    try:
        get_session_for_participant(db, session_id, uid, mid)
    except ChatError as e:
        raise _chat_http(e) from e
    rows = list_messages(db, session_id=session_id, after_id=since_id, limit=limit)
    user, mentor = _session_participants(db, session_id)
    return [_chat_message_out(m, lang, user=user, mentor=mentor) for m in rows]


@router.post("/sessions/{session_id}/end", response_model=ChatSessionOut)
def end_chat_session(
    session_id: str,
    db: DbSession,
    actor: ChatActorDep,
    background_tasks: BackgroundTasks,
) -> ChatSessionOut:
    uid = actor.user.id if actor.user else None
    mid = actor.mentor.id if actor.mentor else None
    if not uid and not mid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        session = end_session(db, session_id=session_id, user_id=uid, mentor_id=mid)
    except ChatError as e:
        raise _chat_http(e) from e
    background_tasks.add_task(_ws_push_session, session_id, session)
    return _session_out(session, db)


@router.get("/sessions/active/me", response_model=ChatSessionOut | None)
def get_my_active_chat_as_mentor(db: DbSession, actor: ChatActorDep) -> ChatSessionOut | None:
    if not actor.mentor:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Coach only")
    session = get_active_session_for_mentor(db, actor.mentor.id)
    if not session:
        return None
    return _session_out(session, db)


def _build_chat_invoice_detail_out(
    db: DbSession,
    session,
    user: User,
    mentor: Mentor,
    purchases: list[ChatPurchase],
    lang: RequestLang,
) -> ChatInvoiceDetailOut:
    total, minutes, currency = aggregate_purchases(purchases)
    issued = max(p.created_at for p in purchases)
    lines = [
        ChatInvoiceLineOut(
            id=p.id,
            minutes=p.minutes,
            amount=str(Decimal(str(p.amount)).quantize(Decimal("0.01"))),
            currency=p.currency,
            status=p.status,
            transaction_id=p.transaction_id,
            created_at=p.created_at,
        )
        for p in purchases
    ]

    msgs = list_all_messages_for_session(db, session.id)
    conversation = [
        ChatInvoiceConversationLineOut(
            id=m.id,
            sender_role=m.sender_role,
            sender_display_name=user.full_name if m.sender_role == CHAT_SENDER_USER else mentor.full_name,
            body=resolve_i18n_text(getattr(m, "body_i18n", None), m.body, lang) or m.body,
            created_at=m.created_at,
        )
        for m in msgs
    ]

    return ChatInvoiceDetailOut(
        invoice_number=_invoice_number(session.id),
        issued_at=issued,
        payment_status=invoice_payment_status(purchases),
        session_id=session.id,
        session_status=session.status,
        session_started_at=session.created_at,
        session_ended_at=session.updated_at,
        session_duration_seconds=_session_wall_duration_seconds(session),
        total_minutes_purchased=minutes,
        total_amount=str(total.quantize(Decimal("0.01"))),
        currency=currency,
        bill_to_name=user.full_name,
        bill_to_email=user.email,
        bill_to_phone=user.phone_number,
        service_provider_name=mentor.full_name,
        service_provider_email=mentor.email,
        line_items=lines,
        conversation=conversation,
    )


@router.get("/invoices", response_model=list[ChatInvoiceSummaryOut])
def list_my_chat_invoices(db: DbSession, me: CurrentUser, lang: RequestLang) -> list[ChatInvoiceSummaryOut]:
    sessions = list_user_chat_invoice_sessions(db, me.id)
    out: list[ChatInvoiceSummaryOut] = []
    for session in sessions:
        mentor = db.query(Mentor).filter(Mentor.id == session.mentor_id).first()
        if not mentor:
            continue
        purchases = db.query(ChatPurchase).filter(ChatPurchase.session_id == session.id).all()
        if not purchases:
            continue
        total, minutes, currency = aggregate_purchases(purchases)
        issued = max(p.created_at for p in purchases)
        out.append(
            ChatInvoiceSummaryOut(
                session_id=session.id,
                invoice_number=_invoice_number(session.id),
                mentor_name=mentor.full_name,
                customer_display_name=me.full_name,
                total_amount=str(total.quantize(Decimal("0.01"))),
                currency=currency,
                total_minutes_purchased=minutes,
                payment_status=invoice_payment_status(purchases),
                session_started_at=session.created_at,
                session_ended_at=session.updated_at,
                issued_at=issued,
            )
        )
    return out


@router.get("/invoices/{session_id}/pdf")
def download_chat_invoice_pdf(session_id: str, db: DbSession, me: CurrentUser) -> Response:
    row = get_user_chat_invoice_detail(db, user_id=me.id, session_id=session_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    session, user, mentor, purchases = row
    payment_status = invoice_payment_status(purchases)
    if payment_status != "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Invoice is downloadable only after payment is completed")
    inv = _invoice_number(session.id)
    messages = list_all_messages_for_session(db, session_id)
    pdf_bytes = build_chat_invoice_pdf(
        invoice_number=inv,
        session=session,
        user=user,
        mentor=mentor,
        purchases=purchases,
        messages=messages,
    )
    safe_name = f"invoice-{inv.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/invoices/{session_id}", response_model=ChatInvoiceDetailOut)
def get_my_chat_invoice(session_id: str, db: DbSession, me: CurrentUser, lang: RequestLang) -> ChatInvoiceDetailOut:
    row = get_user_chat_invoice_detail(db, user_id=me.id, session_id=session_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    session, user, mentor, purchases = row
    return _build_chat_invoice_detail_out(db, session, user, mentor, purchases, lang)


@router.get("/mentor/invoices", response_model=list[ChatInvoiceSummaryOut])
def list_mentor_chat_invoices(db: DbSession, me: CurrentMentor, lang: RequestLang) -> list[ChatInvoiceSummaryOut]:
    _ = lang
    sessions = list_mentor_chat_invoice_sessions(db, me.id)
    out: list[ChatInvoiceSummaryOut] = []
    for session in sessions:
        user = db.query(User).filter(User.id == session.user_id).first()
        mentor = db.query(Mentor).filter(Mentor.id == session.mentor_id).first()
        if not user or not mentor:
            continue
        purchases = db.query(ChatPurchase).filter(ChatPurchase.session_id == session.id).all()
        if not purchases:
            continue
        total, minutes, currency = aggregate_purchases(purchases)
        issued = max(p.created_at for p in purchases)
        out.append(
            ChatInvoiceSummaryOut(
                session_id=session.id,
                invoice_number=_invoice_number(session.id),
                mentor_name=mentor.full_name,
                customer_display_name=user.full_name,
                total_amount=str(total.quantize(Decimal("0.01"))),
                currency=currency,
                total_minutes_purchased=minutes,
                payment_status=invoice_payment_status(purchases),
                session_started_at=session.created_at,
                session_ended_at=session.updated_at,
                issued_at=issued,
            )
        )
    return out


@router.get("/mentor/invoices/{session_id}/pdf")
def download_mentor_chat_invoice_pdf(session_id: str, db: DbSession, me: CurrentMentor) -> Response:
    row = get_mentor_chat_invoice_detail(db, mentor_id=me.id, session_id=session_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    session, user, mentor, purchases = row
    payment_status = invoice_payment_status(purchases)
    if payment_status != "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Invoice is downloadable only after payment is completed")
    inv = _invoice_number(session.id)
    messages = list_all_messages_for_session(db, session_id)
    pdf_bytes = build_chat_invoice_pdf(
        invoice_number=inv,
        session=session,
        user=user,
        mentor=mentor,
        purchases=purchases,
        messages=messages,
    )
    safe_name = f"coach-chat-invoice-{inv.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/mentor/invoices/{session_id}", response_model=ChatInvoiceDetailOut)
def get_mentor_chat_invoice(session_id: str, db: DbSession, me: CurrentMentor, lang: RequestLang) -> ChatInvoiceDetailOut:
    row = get_mentor_chat_invoice_detail(db, mentor_id=me.id, session_id=session_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    session, user, mentor, purchases = row
    return _build_chat_invoice_detail_out(db, session, user, mentor, purchases, lang)
