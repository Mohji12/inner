from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from core.chat_states import (
    CHAT_SENDER_MENTOR,
    CHAT_SENDER_USER,
    CHAT_SESSION_ACTIVE,
    CHAT_SESSION_ENDED,
    CHAT_SESSION_PAUSED,
)
from core.config import settings
from core.security import new_uuid
from models.chat_message import ChatMessage
from models.chat_session import ChatSession
from models.mentor import Mentor
from models.user import User
from services.i18n_service import to_i18n_map
from services.pricing_service import effective_chat_price_per_minute_eur
from services.chat_payment_service import create_chat_purchase_checkout
from services.session_billing_service import finalize_session_billing
from services.live_session_service import (
    communication_mode_for_session,
    join_deadline_expired,
    require_active_meeting_access,
    session_allows_messaging,
    session_remaining_seconds,
    sync_session_time_state,
)
from services.presence_service import presence_service

MAX_MESSAGE_BODY_LEN = 8000


class ChatError(Exception):
    def __init__(self, message: str, code: str = "chat_error"):
        self.message = message
        self.code = code
        super().__init__(message)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def mentor_chat_busy(db: Session, mentor_id: str) -> bool:
    now = _utcnow()
    return (
        db.query(ChatSession.id)
        .filter(
            ChatSession.mentor_id == mentor_id,
            ChatSession.status == CHAT_SESSION_ACTIVE,
            ChatSession.ends_at > now,
        )
        .first()
        is not None
    )


def mentor_ids_with_live_chat(db: Session) -> set[str]:
    now = _utcnow()
    rows = (
        db.query(ChatSession.mentor_id)
        .filter(
            ChatSession.status == CHAT_SESSION_ACTIVE,
            ChatSession.ends_at > now,
        )
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def communication_mode_for_chat_session(db: Session, session_id: str) -> str | None:
    """Deprecated alias — prefer live_session_service.communication_mode_for_session."""
    return communication_mode_for_session(db, session_id)


def hydrate_sessions_for_list(db: Session, sessions: list[ChatSession]) -> None:
    """Apply lazy active→paused for inbox/session lists before serializing."""
    for session in sessions:
        sync_session_time_state(session)
    db.commit()


def start_session_checkout(
    db: Session,
    *,
    user_id: str,
    mentor_id: str,
    minutes: int,
    checkout_currency: str,
    redirect_url: str,
    webhook_url: str | None,
) -> tuple[ChatSession, str, str]:
    if minutes < 1:
        raise ChatError("Minutes must be at least 1", "invalid_minutes")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ChatError("User not found", "user_not_found")
    if not user.email_verified:
        raise ChatError("Email must be verified to start chat", "email_not_verified")

    mentor = (
        db.query(Mentor).filter(Mentor.id == mentor_id).with_for_update().first()
    )
    if not mentor:
        raise ChatError("Mentor not found", "mentor_not_found")
    if not mentor.is_approved or mentor.status != "active":
        raise ChatError("Mentor is not available for chat", "mentor_inactive")
    rate_per_min = effective_chat_price_per_minute_eur(mentor)
    if rate_per_min <= 0:
        raise ChatError("Chat is not enabled for this mentor", "chat_disabled")
    if minutes < mentor.chat_min_purchase_minutes:
        raise ChatError(
            f"Minimum purchase is {mentor.chat_min_purchase_minutes} minutes",
            "below_min_minutes",
        )

    if mentor_chat_busy(db, mentor_id):
        raise ChatError("Mentor is currently in another chat session", "mentor_busy")
    if not presence_service.is_online(mentor_id, "mentor"):
        raise ChatError("Mentor is currently offline", "mentor_offline")

    now = _utcnow()
    # Session starts as paused and gets activated when Mollie webhook confirms payment.
    ends_at = now
    amount_eur_base = (rate_per_min * minutes).quantize(Decimal("0.01"))
    amount_eur_base = (amount_eur_base + Decimal(str(settings.chat_session_transaction_fee_eur))).quantize(
        Decimal("0.01")
    )

    session = ChatSession(
        id=new_uuid(),
        user_id=user_id,
        mentor_id=mentor_id,
        status=CHAT_SESSION_PAUSED,
        ends_at=ends_at,
        created_at=now,
        updated_at=now,
    )
    db.add(session)
    db.flush()
    session_id = session.id

    # Release mentor row lock before Mollie HTTP (avoids blocking presence heartbeats).
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    resolved_redirect_url = redirect_url.format(session_id=session_id, mentor_id=mentor_id)
    try:
        purchase, checkout_url = create_chat_purchase_checkout(
            db,
            session_id=session_id,
            user_id=user_id,
            minutes=minutes,
            amount_eur_base=amount_eur_base,
            checkout_currency=checkout_currency,
            redirect_url=resolved_redirect_url,
            webhook_url=webhook_url,
            is_extension=False,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(session)
    return session, checkout_url, purchase.transaction_id


def quote_session_extension(
    db: Session,
    *,
    session_id: str,
    user_id: str,
    minutes: int,
    checkout_currency: str,
) -> dict:
    if minutes < 1:
        raise ChatError("Minutes must be at least 1", "invalid_minutes")

    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise ChatError("Session not found", "session_not_found")
    if session.user_id != user_id:
        raise ChatError("Forbidden", "forbidden")
    if session.status == CHAT_SESSION_ENDED:
        raise ChatError("Session has ended", "session_ended")

    mentor = db.query(Mentor).filter(Mentor.id == session.mentor_id).first()
    if not mentor:
        raise ChatError("Mentor not found", "mentor_not_found")
    if minutes < mentor.chat_min_purchase_minutes:
        raise ChatError(
            f"Minimum purchase is {mentor.chat_min_purchase_minutes} minutes",
            "below_min_minutes",
        )

    rate_per_min = effective_chat_price_per_minute_eur(mentor)
    session_amount = (rate_per_min * minutes).quantize(Decimal("0.01"))
    transaction_fee = Decimal(str(settings.chat_session_transaction_fee_eur)).quantize(Decimal("0.01"))
    total_eur = (session_amount + transaction_fee).quantize(Decimal("0.01"))

    from services.fx_checkout import eur_to_checkout_amount

    checkout_amount, checkout_ccy, fx_rate = eur_to_checkout_amount(total_eur, checkout_currency)

    return {
        "minutes": minutes,
        "rate_per_minute_eur": str(rate_per_min.quantize(Decimal("0.01"))),
        "session_amount_eur": str(session_amount),
        "transaction_fee_eur": str(transaction_fee),
        "total_eur": str(total_eur),
        "checkout_amount": str(checkout_amount),
        "checkout_currency": checkout_ccy,
        "fx_rate_used": str(fx_rate) if fx_rate is not None and checkout_ccy != "EUR" else None,
        "min_minutes": int(mentor.chat_min_purchase_minutes),
    }


def extend_session_checkout(
    db: Session,
    *,
    session_id: str,
    user_id: str,
    minutes: int,
    checkout_currency: str,
    redirect_url: str,
    webhook_url: str | None,
) -> tuple[ChatSession, str, str]:
    if minutes < 1:
        raise ChatError("Minutes must be at least 1", "invalid_minutes")

    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id)
        .with_for_update()
        .first()
    )
    if not session:
        raise ChatError("Session not found", "session_not_found")
    if session.user_id != user_id:
        raise ChatError("Forbidden", "forbidden")

    mentor = db.query(Mentor).filter(Mentor.id == session.mentor_id).first()
    if not mentor:
        raise ChatError("Mentor not found", "mentor_not_found")
    if minutes < mentor.chat_min_purchase_minutes:
        raise ChatError(
            f"Minimum purchase is {mentor.chat_min_purchase_minutes} minutes",
            "below_min_minutes",
        )

    if session.status == CHAT_SESSION_ENDED:
        raise ChatError("Session has ended", "session_ended")

    rate_per_min = effective_chat_price_per_minute_eur(mentor)
    session_amount = (rate_per_min * minutes).quantize(Decimal("0.01"))
    amount_eur_base = (session_amount + Decimal(str(settings.chat_session_transaction_fee_eur))).quantize(
        Decimal("0.01")
    )
    session.updated_at = _utcnow()
    purchase, checkout_url = create_chat_purchase_checkout(
        db,
        session_id=session.id,
        user_id=user_id,
        minutes=minutes,
        amount_eur_base=amount_eur_base,
        checkout_currency=checkout_currency,
        redirect_url=redirect_url,
        webhook_url=webhook_url,
        is_extension=True,
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(session)
    return session, checkout_url, purchase.transaction_id


def get_session_for_participant(db: Session, session_id: str, user_id: str | None, mentor_id: str | None) -> ChatSession:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise ChatError("Session not found", "session_not_found")
    ok_user = bool(user_id and session.user_id == user_id)
    ok_mentor = bool(mentor_id and session.mentor_id == mentor_id)
    if not (ok_user or ok_mentor):
        raise ChatError("Forbidden", "forbidden")
    sync_session_time_state(session)
    # Automatically mark as read when grabbing the session details? 
    # Actually better to have a separate endpoint for explicit "Read" trigger.
    db.commit()
    db.refresh(session)
    return session


def mark_session_as_read(db: Session, *, session_id: str, role: str) -> None:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        return
    
    now = _utcnow()
    if role == CHAT_SENDER_USER:
        session.unread_count_user = 0
        # Mark all messages SENT BY MENTOR as read
        db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id,
            ChatMessage.sender_role == CHAT_SENDER_MENTOR,
            ChatMessage.read_at == None
        ).update({"read_at": now})
    else:
        session.unread_count_mentor = 0
        # Mark all messages SENT BY USER as read
        db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id,
            ChatMessage.sender_role == CHAT_SENDER_USER,
            ChatMessage.read_at == None
        ).update({"read_at": now})
    
    db.commit()


def list_sessions_for_participant(
    db: Session, *, user_id: str | None = None, mentor_id: str | None = None, limit: int = 50
) -> list[ChatSession]:
    q = db.query(ChatSession)
    if user_id:
        q = q.filter(ChatSession.user_id == user_id)
    if mentor_id:
        q = q.filter(ChatSession.mentor_id == mentor_id)
    
    return q.order_by(ChatSession.last_message_at.desc(), ChatSession.created_at.desc()).limit(limit).all()


def require_session_for_voice_call(
    db: Session, session_id: str, user_id: str | None, mentor_id: str | None
) -> ChatSession:
    """Deprecated alias — prefer live_session_service.require_active_meeting_access."""
    return require_active_meeting_access(db, session_id, user_id, mentor_id)


def post_message(
    db: Session,
    *,
    session_id: str,
    sender_user_id: str | None,
    sender_mentor_id: str | None,
    body: str,
    attachment_url: str | None = None,
    attachment_type: str | None = None,
    attachment_filename: str | None = None,
    attachment_size_bytes: int | None = None,
) -> ChatMessage:
    body_stripped = (body or "").strip()
    has_attachment = bool(attachment_url)
    if not body_stripped and not has_attachment:
        raise ChatError("Message body or image is required", "empty_body")
    if len(body_stripped) > MAX_MESSAGE_BODY_LEN:
        raise ChatError("Message too long", "body_too_long")

    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise ChatError("Session not found", "session_not_found")

    if sender_user_id:
        if session.user_id != sender_user_id:
            raise ChatError("Forbidden", "forbidden")
        role = CHAT_SENDER_USER
    elif sender_mentor_id:
        if session.mentor_id != sender_mentor_id:
            raise ChatError("Forbidden", "forbidden")
        role = CHAT_SENDER_MENTOR
    else:
        raise ChatError("Forbidden", "forbidden")

    if not session_allows_messaging(session):
        if join_deadline_expired(session):
            raise ChatError("Join window has expired", "time_expired")
        raise ChatError("Session is not active", "session_not_active")
    if session_remaining_seconds(session) <= 0:
        session.status = CHAT_SESSION_PAUSED
        session.updated_at = _utcnow()
        db.commit()
        raise ChatError("Chat time has expired", "time_expired")

    now = _utcnow()
    msg = ChatMessage(
        id=new_uuid(),
        session_id=session_id,
        sender_role=role,
        body=body_stripped,
        body_i18n=to_i18n_map(body_stripped) if body_stripped else None,
        attachment_url=attachment_url,
        attachment_type=attachment_type,
        attachment_filename=attachment_filename,
        attachment_size_bytes=attachment_size_bytes,
        created_at=now,
    )
    db.add(msg)
    
    # Update session metadata
    session.last_message_at = now
    session.updated_at = now
    if role == CHAT_SENDER_USER:
        session.unread_count_mentor += 1
    else:
        session.unread_count_user += 1
        
    db.commit()
    db.refresh(msg)
    return msg


def list_messages(
    db: Session,
    *,
    session_id: str,
    after_id: str | None,
    limit: int = 50,
) -> list[ChatMessage]:
    q = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())
    if after_id:
        pivot = db.query(ChatMessage).filter(ChatMessage.id == after_id, ChatMessage.session_id == session_id).first()
        if pivot:
            q = q.filter(ChatMessage.created_at > pivot.created_at)
    return q.limit(min(limit, 200)).all()


def list_all_messages_for_session(
    db: Session,
    session_id: str,
    *,
    max_messages: int = 5000,
) -> list[ChatMessage]:
    """All messages in chronological order (e.g. invoices, exports)."""
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(max_messages)
        .all()
    )


def end_session(
    db: Session,
    *,
    session_id: str,
    user_id: str | None,
    mentor_id: str | None,
) -> ChatSession:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).with_for_update().first()
    if not session:
        raise ChatError("Session not found", "session_not_found")
    ok = (user_id and session.user_id == user_id) or (mentor_id and session.mentor_id == mentor_id)
    if not ok:
        raise ChatError("Forbidden", "forbidden")
    now = _utcnow()
    session.status = CHAT_SESSION_ENDED
    session.updated_at = now
    try:
        finalize_session_billing(db, session_id=session.id)
    except Exception:
        # Legacy purchases-only sessions may not have holds; ending should still succeed.
        pass
    db.commit()
    db.refresh(session)
    return session


def get_active_session_for_mentor(db: Session, mentor_id: str) -> ChatSession | None:
    now = _utcnow()
    return (
        db.query(ChatSession)
        .filter(
            ChatSession.mentor_id == mentor_id,
            ChatSession.status == CHAT_SESSION_ACTIVE,
            ChatSession.ends_at > now,
        )
        .order_by(ChatSession.ends_at.desc())
        .first()
    )
