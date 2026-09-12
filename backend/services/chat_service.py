import logging
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
from services.promo_service import PromoError
from services.refund_service import refund_session_to_user_wallet
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

logger = logging.getLogger(__name__)

MAX_MESSAGE_BODY_LEN = 8000


class ChatError(Exception):
    def __init__(self, message: str, code: str = "chat_error"):
        self.message = message
        self.code = code
        super().__init__(message)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def mentor_chat_busy(db: Session, mentor_id: str) -> bool:
    """True when coach should not accept new live book / talk-now.

    Includes active billed sessions and paid booking sessions still in the join window
    (paused + allocated minutes, deadline not expired).
    """
    now = _utcnow()
    active = (
        db.query(ChatSession.id)
        .filter(
            ChatSession.mentor_id == mentor_id,
            ChatSession.status == CHAT_SESSION_ACTIVE,
            ChatSession.ends_at > now,
        )
        .first()
    )
    if active is not None:
        return True

    # Paid booking waiting for both participants (join window still open).
    waiting_rows = (
        db.query(ChatSession)
        .filter(
            ChatSession.mentor_id == mentor_id,
            ChatSession.status == CHAT_SESSION_PAUSED,
            ChatSession.allocated_duration_minutes.isnot(None),
            ChatSession.timer_started_at.is_(None),
        )
        .all()
    )
    for row in waiting_rows:
        if not join_deadline_expired(row):
            return True
    return False


def mentor_ids_with_live_chat(db: Session) -> set[str]:
    now = _utcnow()
    active_ids = {
        r[0]
        for r in (
            db.query(ChatSession.mentor_id)
            .filter(
                ChatSession.status == CHAT_SESSION_ACTIVE,
                ChatSession.ends_at > now,
            )
            .distinct()
            .all()
        )
    }
    waiting = (
        db.query(ChatSession)
        .filter(
            ChatSession.status == CHAT_SESSION_PAUSED,
            ChatSession.allocated_duration_minutes.isnot(None),
            ChatSession.timer_started_at.is_(None),
        )
        .all()
    )
    for row in waiting:
        if not join_deadline_expired(row):
            active_ids.add(row.mentor_id)
    return active_ids


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
    promo_code: str | None = None,
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
    if not presence_service.is_online(mentor_id, "mentor", last_seen_at=mentor.last_seen_at):
        raise ChatError("Mentor is currently offline", "mentor_offline")
    from services.mentor_unavailability_service import mentor_unavailable_now

    if mentor_unavailable_now(db, mentor_id):
        raise ChatError("Mentor is marked as unavailable at this time", "mentor_unavailable")
    from services.mentor_availability_service import mentor_manual_occupied

    if mentor_manual_occupied(db, mentor_id):
        raise ChatError("Mentor is marked as occupied and not taking new sessions", "mentor_occupied")

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
            mentor_id=mentor_id,
            minutes=minutes,
            amount_eur_base=amount_eur_base,
            checkout_currency=checkout_currency,
            redirect_url=resolved_redirect_url,
            webhook_url=webhook_url,
            is_extension=False,
            promo_code=promo_code,
        )
        db.commit()
    except PromoError as e:
        db.rollback()
        raise ChatError(str(e), "promo_invalid") from e
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

    # Ended sessions may be continued later on the same thread after payment.
    rate_per_min = effective_chat_price_per_minute_eur(mentor)
    session_amount = (rate_per_min * minutes).quantize(Decimal("0.01"))
    amount_eur_base = (session_amount + Decimal(str(settings.chat_session_transaction_fee_eur))).quantize(
        Decimal("0.01")
    )
    # Freeze billed countdown so Mollie checkout time does not eat remaining session minutes.
    from services.live_session_service import freeze_session_timer_for_payment

    freeze_session_timer_for_payment(session)
    session.updated_at = _utcnow()
    purchase, checkout_url = create_chat_purchase_checkout(
        db,
        session_id=session.id,
        user_id=user_id,
        mentor_id=session.mentor_id,
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


def extend_session_with_wallet(
    db: Session,
    *,
    session_id: str,
    user_id: str,
    minutes: int,
) -> tuple[ChatSession, str, str]:
    """Pay for session extension from wallet credits (instant, no Mollie). Returns session, amount, currency."""
    from core.chat_states import CHAT_PURCHASE_SUCCEEDED
    from models.chat_purchase import ChatPurchase
    from models.wallet import Wallet
    from services.ledger_service import (
        ACCOUNT_USER_AVAILABLE,
        OWNER_USER,
        LedgerError,
        get_account_balance,
        get_or_create_wallet_account,
        q2,
        spend_user_available_for_chat_purchase,
    )
    from services.live_session_service import (
        freeze_session_timer_for_payment,
        resume_frozen_session_timer,
    )
    from services.mollie_service import _apply_chat_purchase_paid
    from services.wallet_service import WalletError, debit_wallet, get_or_create_wallet

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

    rate_per_min = effective_chat_price_per_minute_eur(mentor)
    session_amount = (rate_per_min * minutes).quantize(Decimal("0.01"))
    amount_eur = (session_amount + Decimal(str(settings.chat_session_transaction_fee_eur))).quantize(
        Decimal("0.01")
    )
    amount_eur = q2(amount_eur)
    currency = "EUR"

    wallet = get_or_create_wallet(db, user_id, commit=False)
    wallet = db.query(Wallet).filter(Wallet.id == wallet.id).with_for_update().first() or wallet
    if amount_eur > 0 and q2(wallet.balance) < amount_eur:
        raise ChatError("Insufficient wallet balance", "insufficient_wallet")

    user_available = get_or_create_wallet_account(
        db,
        owner_type=OWNER_USER,
        owner_id=user_id,
        account_kind=ACCOUNT_USER_AVAILABLE,
        currency=currency,
    )
    if amount_eur > 0 and get_account_balance(db, user_available.id) < amount_eur:
        raise ChatError("Insufficient wallet balance", "insufficient_wallet")

    freeze_session_timer_for_payment(session)
    session.updated_at = _utcnow()

    purchase_id = new_uuid()
    txn_id = f"wallet_{purchase_id.replace('-', '')}"

    try:
        if amount_eur > 0:
            spend_user_available_for_chat_purchase(
                db,
                user_id=user_id,
                amount=amount_eur,
                currency=currency,
                purchase_id=purchase_id,
                session_id=session.id,
            )
            debit_wallet(
                db,
                user_id=user_id,
                amount=amount_eur,
                description=f"Chat extension {minutes} min",
                reference_type="chat_purchase",
                reference_id=purchase_id,
                commit=False,
            )
        purchase = ChatPurchase(
            id=purchase_id,
            session_id=session.id,
            user_id=user_id,
            minutes=minutes,
            amount=amount_eur,
            amount_base_eur=amount_eur,
            currency=currency,
            fx_rate_used=None,
            status=CHAT_PURCHASE_SUCCEEDED,
            transaction_id=txn_id,
            created_at=_utcnow(),
        )
        db.add(purchase)
        db.flush()
        _apply_chat_purchase_paid(db, purchase)
    except (LedgerError, WalletError) as e:
        resume_frozen_session_timer(session, add_minutes=0)
        msg = str(e)
        if "Insufficient" in msg:
            raise ChatError("Insufficient wallet balance", "insufficient_wallet") from e
        raise ChatError(msg, "wallet_pay_failed") from e
    except Exception:
        resume_frozen_session_timer(session, add_minutes=0)
        raise

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(session)
    return session, str(amount_eur), currency


def get_session_for_participant(db: Session, session_id: str, user_id: str | None, mentor_id: str | None) -> ChatSession:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise ChatError("Session not found", "session_not_found")
    ok_user = bool(user_id and session.user_id == user_id)
    ok_mentor = bool(mentor_id and session.mentor_id == mentor_id)
    if not (ok_user or ok_mentor):
        raise ChatError("Forbidden", "forbidden")
    sync_session_time_state(session)
    # Avoid write+refresh on every poll when nothing changed.
    if session in db.dirty:
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
    """
    Return messages for a session.

    - With after_id: forward sync (messages newer than the pivot), oldest→newest.
    - Without after_id: newest `limit` messages (for fast room open), oldest→newest.
    """
    cap = min(max(1, limit), 200)
    if after_id:
        pivot = (
            db.query(ChatMessage)
            .filter(ChatMessage.id == after_id, ChatMessage.session_id == session_id)
            .first()
        )
        q = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        if pivot:
            q = q.filter(ChatMessage.created_at > pivot.created_at)
        return q.limit(cap).all()

    newest = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(cap)
        .all()
    )
    newest.reverse()
    return newest


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

    try:
        refund_session_to_user_wallet(db, session=session, actor_user_id=user_id, commit=False)
    except Exception as e:
        logger.warning("Refund on session end failed for session %s: %s", session.id, e)

    db.commit()
    db.refresh(session)
    return session


def get_active_session_for_mentor(db: Session, mentor_id: str) -> ChatSession | None:
    """Return the coach's live room, including paid booking sessions still in the join window."""
    now = _utcnow()
    active = (
        db.query(ChatSession)
        .filter(
            ChatSession.mentor_id == mentor_id,
            ChatSession.status == CHAT_SESSION_ACTIVE,
            ChatSession.ends_at > now,
        )
        .order_by(ChatSession.ends_at.desc())
        .first()
    )
    if active is not None:
        return active

    waiting = (
        db.query(ChatSession)
        .filter(
            ChatSession.mentor_id == mentor_id,
            ChatSession.status == CHAT_SESSION_PAUSED,
            ChatSession.allocated_duration_minutes.isnot(None),
            ChatSession.timer_started_at.is_(None),
            ChatSession.ends_at > now,
        )
        .order_by(ChatSession.ends_at.asc())
        .all()
    )
    for row in waiting:
        if not join_deadline_expired(row):
            return row
    return None
