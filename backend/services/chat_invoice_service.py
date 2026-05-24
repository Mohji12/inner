"""Build chat payment invoices from sessions + chat_purchases (user-facing)."""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from services.mentor_monthly_fee_service import chat_purchase_eur_base_amount

from core.chat_states import CHAT_SESSION_ACTIVE
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.mentor import Mentor
from models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_live_session(session: ChatSession, now: datetime) -> bool:
    ends = session.ends_at
    if ends.tzinfo is None:
        ends = ends.replace(tzinfo=timezone.utc)
    return session.status == CHAT_SESSION_ACTIVE and ends > now


def list_user_chat_invoice_sessions(db: Session, user_id: str) -> list[ChatSession]:
    """Sessions that are finished (not live) and have at least one purchase."""
    now = _utcnow()
    rows = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    out: list[ChatSession] = []
    for s in rows:
        if _is_live_session(s, now):
            continue
        if db.query(ChatPurchase.id).filter(ChatPurchase.session_id == s.id).first():
            out.append(s)
    return out


def get_user_chat_invoice_detail(db: Session, *, user_id: str, session_id: str) -> tuple[ChatSession, User, Mentor, list[ChatPurchase]] | None:
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not session:
        return None
    now = _utcnow()
    if _is_live_session(session, now):
        return None
    purchases = (
        db.query(ChatPurchase)
        .filter(ChatPurchase.session_id == session_id)
        .order_by(ChatPurchase.created_at.asc())
        .all()
    )
    if not purchases:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    mentor = db.query(Mentor).filter(Mentor.id == session.mentor_id).first()
    if not user or not mentor:
        return None
    return session, user, mentor, purchases


def list_mentor_chat_invoice_sessions(db: Session, mentor_id: str) -> list[ChatSession]:
    """Completed sessions for this coach with at least one purchase (receipt-style list)."""
    now = _utcnow()
    rows = (
        db.query(ChatSession)
        .filter(ChatSession.mentor_id == mentor_id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    out: list[ChatSession] = []
    for s in rows:
        if _is_live_session(s, now):
            continue
        if db.query(ChatPurchase.id).filter(ChatPurchase.session_id == s.id).first():
            out.append(s)
    return out


def get_mentor_chat_invoice_detail(db: Session, *, mentor_id: str, session_id: str) -> tuple[ChatSession, User, Mentor, list[ChatPurchase]] | None:
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.mentor_id == mentor_id).first()
    if not session:
        return None
    now = _utcnow()
    if _is_live_session(session, now):
        return None
    purchases = (
        db.query(ChatPurchase)
        .filter(ChatPurchase.session_id == session_id)
        .order_by(ChatPurchase.created_at.asc())
        .all()
    )
    if not purchases:
        return None
    user = db.query(User).filter(User.id == session.user_id).first()
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not user or not mentor:
        return None
    return session, user, mentor, purchases


def aggregate_purchases(purchases: list[ChatPurchase]) -> tuple[Decimal, int, str]:
    total = Decimal("0")
    minutes = 0
    for p in purchases:
        total += chat_purchase_eur_base_amount(p)
        minutes += int(p.minutes)
    return total, minutes, "EUR"


def invoice_payment_status(purchases: list[ChatPurchase]) -> str:
    """Aggregate purchase rows into one invoice payment status."""
    if not purchases:
        return "unpaid"
    statuses = {str(p.status or "").lower() for p in purchases}
    if statuses.issubset({"succeeded", "paid", "completed"}):
        return "paid"
    if "pending" in statuses or "open" in statuses:
        return "pending"
    if "failed" in statuses or "canceled" in statuses or "expired" in statuses:
        return "failed"
    return "pending"
