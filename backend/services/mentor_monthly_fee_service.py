from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from core.booking_states import PAYMENT_RECORD_SUCCEEDED
from core.config import settings
from core.security import new_uuid
from db.session import SessionLocal
from models.booking import Booking
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.mentor import Mentor
from models.mentor_monthly_invoice import MentorMonthlyInvoice
from models.payment import Payment
from services.fx_checkout import eur_to_checkout_amount
from services.mollie_service import MollieServiceError, create_mollie_payment, resolve_mollie_webhook_url

MONEY_Q = Decimal("0.01")


def payment_eur_base_amount(p: Payment) -> Decimal:
    if getattr(p, "amount_base_eur", None) is not None:
        return Decimal(str(p.amount_base_eur))
    return Decimal(str(p.amount))


def chat_purchase_eur_base_amount(cp: ChatPurchase) -> Decimal:
    if getattr(cp, "amount_base_eur", None) is not None:
        return Decimal(str(cp.amount_base_eur))
    return Decimal(str(cp.amount))


def _month_anchor(d: date) -> date:
    return date(d.year, d.month, 1)


def _prev_month_anchor(now: date) -> date:
    first = _month_anchor(now)
    prev_day = first - timedelta(days=1)
    return _month_anchor(prev_day)


def _month_range(month_anchor: date) -> tuple[date, date]:
    start = month_anchor
    if month_anchor.month == 12:
        nxt = date(month_anchor.year + 1, 1, 1)
    else:
        nxt = date(month_anchor.year, month_anchor.month + 1, 1)
    end = nxt - timedelta(days=1)
    return start, end


def _q(v: Decimal) -> Decimal:
    return Decimal(str(v)).quantize(MONEY_Q, rounding=ROUND_HALF_UP)


def _mentor_revenue_for_month(db: Session, mentor_id: str, month_anchor: date) -> Decimal:
    start, end = _month_range(month_anchor)
    booking_rows = (
        db.query(Booking.id)
        .filter(Booking.mentor_id == mentor_id, Booking.booking_date >= start, Booking.booking_date <= end)
        .all()
    )
    booking_ids = [r[0] for r in booking_rows]
    booking_sum = Decimal("0")
    if booking_ids:
        pays = (
            db.query(Booking, )
            .filter(Booking.id.in_(booking_ids))
            .all()
        )
        _ = pays
        booking_payments = (
            db.query(Payment)
            .filter(Payment.booking_id.in_(booking_ids), Payment.status == PAYMENT_RECORD_SUCCEEDED)
            .all()
        )
        for p in booking_payments:
            booking_sum += payment_eur_base_amount(p)

    chat_rows = (
        db.query(ChatPurchase)
        .join(ChatSession, ChatSession.id == ChatPurchase.session_id)
        .filter(
            ChatSession.mentor_id == mentor_id,
            ChatPurchase.status.in_(["succeeded", "paid", "completed"]),
            ChatPurchase.created_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc),
            ChatPurchase.created_at <= datetime.combine(end, datetime.max.time(), tzinfo=timezone.utc),
        )
        .all()
    )
    chat_sum = sum((chat_purchase_eur_base_amount(r) for r in chat_rows), Decimal("0"))
    return _q(booking_sum + chat_sum)


def ensure_monthly_invoice_mollie_checkout(
    db: Session,
    *,
    invoice: MentorMonthlyInvoice,
    mentor: Mentor,
    checkout_currency: str,
    webhook_url: str | None,
    force_new: bool = False,
) -> MentorMonthlyInvoice:
    """
    Ensures `invoice` has a Mollie payment in `checkout_currency` (converted from EUR `fee_amount`).
    When `force_new` or currency changes, replaces `mollie_payment_id` / URL (prior Mollie payment may remain orphaned).
    """
    if invoice.status == "paid":
        return invoice
    fee_amount = Decimal(str(invoice.fee_amount))
    if fee_amount <= 0:
        return invoice

    charged, ccy, fx_rate = eur_to_checkout_amount(fee_amount, checkout_currency)

    normalized_existing = (invoice.checkout_currency or "").strip().upper()
    if (
        invoice.mollie_payment_id
        and invoice.mollie_checkout_url
        and normalized_existing == ccy
        and not force_new
    ):
        return invoice

    redirect_url = f"{settings.mollie_redirect_base_url.rstrip('/')}/mentor/invoices"
    payment_id, checkout_url = create_mollie_payment(
        amount=charged,
        currency=ccy,
        description=f"Mentor monthly fee {mentor.email} {invoice.invoice_month.isoformat()}",
        redirect_url=redirect_url,
        webhook_url=webhook_url,
        metadata={"kind": "mentor_monthly_invoice", "invoice_id": invoice.id, "mentor_id": mentor.id},
    )
    invoice.mollie_payment_id = payment_id
    invoice.mollie_checkout_url = checkout_url
    invoice.checkout_amount = charged
    invoice.checkout_currency = ccy
    invoice.fee_fx_rate = fx_rate if ccy != "EUR" else None
    invoice.status = "open"
    invoice.updated_at = datetime.now(timezone.utc)
    db.flush()
    return invoice


def create_or_refresh_monthly_invoice(
    db: Session, mentor: Mentor, month_anchor: date, checkout_currency: str = "EUR"
) -> MentorMonthlyInvoice | None:
    gross = _mentor_revenue_for_month(db, mentor.id, month_anchor)
    if gross <= 0:
        return None
    fee_percent = Decimal(str(settings.mentor_monthly_fee_percent))
    fee_amount = _q((gross * fee_percent) / Decimal("100"))
    now = datetime.now(timezone.utc)

    inv = (
        db.query(MentorMonthlyInvoice)
        .filter(MentorMonthlyInvoice.mentor_id == mentor.id, MentorMonthlyInvoice.invoice_month == month_anchor)
        .first()
    )
    if not inv:
        inv = MentorMonthlyInvoice(
            id=new_uuid(),
            mentor_id=mentor.id,
            invoice_month=month_anchor,
            gross_revenue=gross,
            fee_percent=fee_percent,
            fee_amount=fee_amount,
            currency=settings.payment_currency,
            status="open",
            mollie_payment_id=None,
            mollie_checkout_url=None,
            paid_at=None,
            reminder_sent_at=None,
            created_at=now,
            updated_at=now,
        )
        db.add(inv)
        db.flush()
    else:
        if inv.status == "paid":
            return inv
        inv.gross_revenue = gross
        inv.fee_percent = fee_percent
        inv.fee_amount = fee_amount
        inv.updated_at = now

    if not inv.mollie_payment_id:
        webhook_url = resolve_mollie_webhook_url(None)
        ensure_monthly_invoice_mollie_checkout(
            db,
            invoice=inv,
            mentor=mentor,
            checkout_currency=checkout_currency,
            webhook_url=webhook_url,
            force_new=True,
        )
    return inv


def generate_monthly_invoices_for_previous_month() -> None:
    db = SessionLocal()
    try:
        month_anchor = _prev_month_anchor(datetime.now(timezone.utc).date())
        mentors = db.query(Mentor).filter(Mentor.is_approved == True, Mentor.status == "active").all()  # noqa: E712
        for mentor in mentors:
            try:
                create_or_refresh_monthly_invoice(db, mentor, month_anchor)
            except MollieServiceError:
                # Keep processing other mentors.
                continue
        db.commit()
    finally:
        db.close()
