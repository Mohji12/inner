from __future__ import annotations

import time
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from core.chat_states import CHAT_SESSION_ACTIVE, CHAT_SESSION_ENDED, CHAT_SESSION_PAUSED
from core.config import settings
from models.chat_session import ChatSession
from models.mentor import Mentor
from models.marketplace import SessionBillingEvent, WalletHold
from services.pricing_service import effective_chat_price_per_minute_eur
from services.ledger_service import (
    LedgerError,
    consume_hold_for_session,
    current_price_per_second_for_session,
    release_session_hold,
    reserve_user_hold_for_session,
    q2,
)


class SessionBillingError(Exception):
    pass


def _is_mysql_deadlock(exc: Exception) -> bool:
    if not isinstance(exc, OperationalError):
        return False
    orig = getattr(exc, "orig", None)
    code = getattr(orig, "args", (None,))[0] if orig is not None else None
    if code == 1213:
        return True
    msg = str(exc)
    return "1213" in msg or "Deadlock" in msg


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _seconds_since_last_event(db: Session, *, hold_id: str) -> int:
    latest = (
        db.query(SessionBillingEvent)
        .filter(
            SessionBillingEvent.hold_id == hold_id,
            SessionBillingEvent.event_type == "consume",
        )
        .order_by(SessionBillingEvent.created_at.desc())
        .first()
    )
    if not latest:
        return settings.marketplace_billing_tick_seconds
    now = _utcnow()
    last = _to_utc(latest.created_at)
    seconds = int((now - last).total_seconds())
    return max(1, min(120, seconds))


def reserve_for_session_start(
    db: Session,
    *,
    session_id: str,
    reserve_amount: Decimal,
    currency: str = "EUR",
) -> WalletHold:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).with_for_update().first()
    if not session:
        raise SessionBillingError("Session not found")
    hold = (
        db.query(WalletHold)
        .filter(WalletHold.session_id == session.id, WalletHold.status.in_(["active", "consumed"]))
        .order_by(WalletHold.created_at.desc())
        .first()
    )
    if hold:
        return hold
    mentor = db.query(Mentor).filter(Mentor.id == session.mentor_id).first()
    if not mentor:
        raise SessionBillingError("Mentor not found")
    min_reserve = q2(
        q2(settings.chat_session_transaction_fee_eur) + q2(effective_chat_price_per_minute_eur(mentor))
    )
    if q2(reserve_amount) < min_reserve:
        raise SessionBillingError(
            f"Reserve amount must be at least {min_reserve} EUR (session fee plus one minute at the coach rate)."
        )
    return reserve_user_hold_for_session(
        db,
        user_id=session.user_id,
        session_id=session.id,
        amount=q2(reserve_amount),
        currency=currency,
    )


def _process_session_heartbeat_once(db: Session, *, session_id: str) -> dict:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).with_for_update().first()
    if not session:
        raise SessionBillingError("Session not found")
    hold = (
        db.query(WalletHold)
        .filter(WalletHold.session_id == session_id, WalletHold.status.in_(["active", "consumed"]))
        .order_by(WalletHold.created_at.desc())
        .first()
    )
    if not hold:
        raise SessionBillingError("Session hold not reserved")
    if session.status != CHAT_SESSION_ACTIVE:
        return {"status": session.status, "event": None}

    elapsed = _seconds_since_last_event(db, hold_id=hold.id)
    per_sec = current_price_per_second_for_session(db, mentor_id=session.mentor_id)
    gross = (Decimal(elapsed) * per_sec).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if gross <= 0:
        return {"status": session.status, "event": None}
    try:
        event = consume_hold_for_session(
            db,
            hold=hold,
            mentor_id=session.mentor_id,
            amount_gross=gross,
            seconds_billed=elapsed,
        )
        remaining = q2(Decimal(str(hold.amount_reserved)) - Decimal(str(hold.amount_consumed)))
        if remaining <= Decimal("0.00"):
            session.status = CHAT_SESSION_PAUSED
            session.updated_at = _utcnow()
        return {
            "status": session.status,
            "event": event,
            "remaining_hold": str(remaining),
        }
    except LedgerError:
        session.status = CHAT_SESSION_PAUSED
        session.updated_at = _utcnow()
        return {"status": session.status, "event": None, "remaining_hold": "0.00"}


def process_session_heartbeat(db: Session, *, session_id: str) -> dict:
    """Bill one tick; retries on MySQL deadlock (1213) after rollback."""
    for attempt in range(4):
        if attempt:
            time.sleep(0.02 * (2 ** (attempt - 1)))
        try:
            return _process_session_heartbeat_once(db, session_id=session_id)
        except OperationalError as e:
            if _is_mysql_deadlock(e) and attempt < 3:
                db.rollback()
                continue
            raise
    raise RuntimeError("session heartbeat retry loop exhausted")


def finalize_session_billing(db: Session, *, session_id: str) -> dict:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).with_for_update().first()
    if not session:
        raise SessionBillingError("Session not found")
    hold = (
        db.query(WalletHold)
        .filter(WalletHold.session_id == session_id, WalletHold.status.in_(["active", "consumed"]))
        .order_by(WalletHold.created_at.desc())
        .first()
    )
    if not hold:
        return {"released": False}
    release_ev = release_session_hold(db, hold=hold)
    session.status = CHAT_SESSION_ENDED
    session.updated_at = _utcnow()
    return {"released": release_ev is not None, "event_id": release_ev.id if release_ev else None}
