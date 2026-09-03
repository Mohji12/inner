from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import os

from sqlalchemy.orm import Session

from core.security import new_uuid
from models.booking import Booking
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.mentor import Mentor
from models.mentor_settlement import MentorSettlement, MentorSettlementItem
from models.payment import Payment

MONEY_Q = Decimal("0.01")
SUCCESS_PAYMENT_STATUSES = ("completed", "paid", "succeeded")
SUCCESS_CHAT_STATUSES = ("completed", "paid", "succeeded")


class SettlementError(Exception):
    pass


@dataclass
class SettlementSource:
    mentor_id: str
    source_type: str
    source_id: str
    amount: Decimal
    currency: str
    created_at: datetime


@dataclass
class SettlementCandidate:
    mentor_id: str
    mentor_name: str
    currency: str
    gross_amount: Decimal
    fee_amount: Decimal
    net_amount: Decimal
    item_count: int


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _quantize(amount: Decimal) -> Decimal:
    return amount.quantize(MONEY_Q, rounding=ROUND_HALF_UP)


def settlement_cycle_bounds(cycle_end: date | None = None) -> tuple[date, date]:
    end = cycle_end or _utcnow().date()
    start = end - timedelta(days=14)
    return start, end


def settlement_eligible_cutoff(cycle_end: date | None = None) -> datetime:
    end = cycle_end or _utcnow().date()
    cutoff_date = end - timedelta(days=15)
    return datetime.combine(cutoff_date, datetime.min.time(), tzinfo=timezone.utc)


def settlement_fee_percent() -> Decimal:
    raw = os.getenv("SETTLEMENT_FEE_PERCENT", "0")
    try:
        v = Decimal(str(raw))
    except Exception:
        v = Decimal("0")
    if v < 0:
        v = Decimal("0")
    return v


def _already_settled_source_ids(db: Session, source_type: str) -> set[str]:
    rows = db.query(MentorSettlementItem.source_id).filter(MentorSettlementItem.source_type == source_type).all()
    return {r[0] for r in rows}


def _to_aware(v: datetime) -> datetime:
    if v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v


def _fetch_booking_sources(db: Session, start: date, end: date, cutoff: datetime) -> list[SettlementSource]:
    settled_ids = _already_settled_source_ids(db, "booking")
    rows = (
        db.query(Payment, Booking)
        .join(Booking, Booking.id == Payment.booking_id)
        .join(Mentor, Mentor.id == Booking.mentor_id)
        .filter(Payment.status.in_(SUCCESS_PAYMENT_STATUSES))
        .filter(Mentor.is_approved == True)  # noqa: E712
        .filter(Mentor.status == "active")
        .all()
    )
    out: list[SettlementSource] = []
    for pay, booking in rows:
        if pay.id in settled_ids:
            continue
        created = _to_aware(pay.created_at)
        if created.date() < start or created.date() > end or created > cutoff:
            continue
        out.append(
            SettlementSource(
                mentor_id=booking.mentor_id,
                source_type="booking",
                source_id=pay.id,
                amount=Decimal(str(pay.amount)),
                currency=pay.currency,
                created_at=created,
            )
        )
    return out


def _fetch_chat_sources(db: Session, start: date, end: date, cutoff: datetime) -> list[SettlementSource]:
    settled_ids = _already_settled_source_ids(db, "chat_purchase")
    rows = (
        db.query(ChatPurchase, ChatSession, Mentor)
        .join(ChatSession, ChatSession.id == ChatPurchase.session_id)
        .join(Mentor, Mentor.id == ChatSession.mentor_id)
        .filter(ChatPurchase.status.in_(SUCCESS_CHAT_STATUSES))
        .filter(Mentor.is_approved == True)  # noqa: E712
        .filter(Mentor.status == "active")
        .all()
    )
    out: list[SettlementSource] = []
    for purchase, session, _mentor in rows:
        if purchase.id in settled_ids:
            continue
        created = _to_aware(purchase.created_at)
        if created.date() < start or created.date() > end or created > cutoff:
            continue
        out.append(
            SettlementSource(
                mentor_id=session.mentor_id,
                source_type="chat_purchase",
                source_id=purchase.id,
                amount=Decimal(str(purchase.amount)),
                currency=purchase.currency,
                created_at=created,
            )
        )
    return out


def gather_settlement_sources(db: Session, cycle_start: date, cycle_end: date) -> list[SettlementSource]:
    cutoff = settlement_eligible_cutoff(cycle_end)
    return _fetch_booking_sources(db, cycle_start, cycle_end, cutoff) + _fetch_chat_sources(db, cycle_start, cycle_end, cutoff)


def compute_candidates(db: Session, cycle_start: date, cycle_end: date) -> list[SettlementCandidate]:
    grouped: dict[tuple[str, str], list[SettlementSource]] = {}
    for src in gather_settlement_sources(db, cycle_start, cycle_end):
        grouped.setdefault((src.mentor_id, src.currency), []).append(src)

    fee_pct = settlement_fee_percent()
    out: list[SettlementCandidate] = []
    for (mentor_id, currency), items in grouped.items():
        mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
        if not mentor:
            continue
        gross = _quantize(sum((i.amount for i in items), Decimal("0")))
        fee = _quantize((gross * fee_pct) / Decimal("100"))
        net = _quantize(gross - fee)
        if net < 0:
            net = Decimal("0.00")
        out.append(
            SettlementCandidate(
                mentor_id=mentor_id,
                mentor_name=mentor.full_name,
                currency=currency,
                gross_amount=gross,
                fee_amount=fee,
                net_amount=net,
                item_count=len(items),
            )
        )
    out.sort(key=lambda c: (c.mentor_name.lower(), c.currency))
    return out


def generate_settlements(db: Session, *, cycle_start: date, cycle_end: date, created_by_admin_id: str) -> list[MentorSettlement]:
    existing = (
        db.query(MentorSettlement.id)
        .filter(MentorSettlement.cycle_start == cycle_start, MentorSettlement.cycle_end == cycle_end)
        .first()
    )
    if existing:
        raise SettlementError("Settlement cycle already generated for this date range")

    grouped: dict[tuple[str, str], list[SettlementSource]] = {}
    for src in gather_settlement_sources(db, cycle_start, cycle_end):
        grouped.setdefault((src.mentor_id, src.currency), []).append(src)

    fee_pct = settlement_fee_percent()
    now = _utcnow()
    created: list[MentorSettlement] = []
    for (mentor_id, currency), items in grouped.items():
        gross = _quantize(sum((i.amount for i in items), Decimal("0")))
        if gross <= 0:
            continue
        fee = _quantize((gross * fee_pct) / Decimal("100"))
        net = _quantize(gross - fee)
        settlement = MentorSettlement(
            id=new_uuid(),
            mentor_id=mentor_id,
            currency=currency,
            cycle_start=cycle_start,
            cycle_end=cycle_end,
            gross_amount=gross,
            fee_amount=fee,
            net_amount=net,
            status="pending",
            created_by_admin=created_by_admin_id,
            approved_by_admin=None,
            provider_batch_ref=None,
            failure_reason=None,
            paid_at=None,
            created_at=now,
            updated_at=now,
        )
        db.add(settlement)
        db.flush()
        for src in items:
            db.add(
                MentorSettlementItem(
                    id=new_uuid(),
                    settlement_id=settlement.id,
                    source_type=src.source_type,
                    source_id=src.source_id,
                    amount=_quantize(src.amount),
                    created_at=now,
                )
            )
        created.append(settlement)
    db.commit()
    return created


def approve_settlement(db: Session, settlement: MentorSettlement, admin_id: str) -> MentorSettlement:
    if settlement.status != "pending":
        raise SettlementError("Only pending settlements can be approved")
    settlement.status = "approved"
    settlement.approved_by_admin = admin_id
    settlement.updated_at = _utcnow()
    db.commit()
    db.refresh(settlement)
    return settlement


