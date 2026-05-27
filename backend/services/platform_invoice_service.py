"""Load booking / coach-fee records into structured invoice DTOs."""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from core.config import settings
from models.booking import Booking
from models.mentor import Mentor
from models.mentor_monthly_invoice import MentorMonthlyInvoice
from models.mentor_onboarding_payment import MentorOnboardingPayment
from models.payment import Payment
from models.user import User
from core.booking_states import PAYMENT_RECORD_SUCCEEDED, STATUS_COMPLETED, STATUS_CONFIRMED
from schemas.platform_invoice import (
    BookingInvoiceOut,
    BookingInvoiceSummaryOut,
    MentorMonthlyFeeStatementOut,
    MentorOnboardingInvoiceOut,
)
from services.invoice_errors import InvoiceError


def _platform_contact() -> str:
    return (settings.smtp_from_email or "contact@mijnlevenspad.nl").strip() or "contact@mijnlevenspad.nl"


def booking_invoice_number(booking_id: str) -> str:
    return f"BOOK-{booking_id[:8].upper()}"


def monthly_fee_invoice_number(invoice_id: str, invoice_month: str) -> str:
    ym = invoice_month.replace("-", "")[:6] if invoice_month else ""
    return f"MFEE-{ym}-{invoice_id[:8].upper()}"


def onboarding_invoice_number(payment_id: str) -> str:
    return f"ONB-{payment_id[:8].upper()}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_booking_payment(db: Session, booking: Booking) -> Payment | None:
    """Pick the succeeded payment for a booking (handles duplicate payment rows)."""
    if booking.payment_id:
        linked = db.query(Payment).filter(Payment.id == booking.payment_id).first()
        if linked:
            return linked
    return (
        db.query(Payment)
        .filter(Payment.booking_id == booking.id, Payment.status == PAYMENT_RECORD_SUCCEEDED)
        .order_by(Payment.created_at.desc())
        .first()
        or db.query(Payment)
        .filter(Payment.booking_id == booking.id)
        .order_by(Payment.created_at.desc())
        .first()
    )


def _booking_eligible_for_invoice(booking: Booking, payment: Payment | None, now: datetime) -> bool:
    if not payment:
        return False
    if str(payment.status) != PAYMENT_RECORD_SUCCEEDED:
        return False
    if str(booking.status) == STATUS_COMPLETED:
        return True
    if str(booking.status) == STATUS_CONFIRMED:
        end = booking.end_at_utc
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        return end <= now
    return False


def list_user_booking_invoice_summaries(db: Session, user_id: str) -> list[BookingInvoiceSummaryOut]:
    """Paid bookings whose session window has ended — includes promo (€0) checkouts."""
    now = _utcnow()
    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.user), joinedload(Booking.mentor))
        .filter(Booking.user_id == user_id)
        .order_by(Booking.start_at_utc.desc())
        .all()
    )
    out: list[BookingInvoiceSummaryOut] = []
    for booking in bookings:
        payment = _resolve_booking_payment(db, booking)
        if not _booking_eligible_for_invoice(booking, payment, now):
            continue
        if not payment:
            continue
        user: User = booking.user
        mentor: Mentor = booking.mentor
        promo_applied = str(payment.payment_gateway or "").strip().lower() == "promo"
        amount_display = Decimal(str(payment.amount)).quantize(Decimal("0.01"))
        pay_status = "paid" if str(payment.status) == PAYMENT_RECORD_SUCCEEDED else str(payment.status)
        out.append(
            BookingInvoiceSummaryOut(
                booking_id=booking.id,
                invoice_number=booking_invoice_number(booking.id),
                mentor_name=mentor.full_name or "Coach",
                customer_name=user.full_name or "Customer",
                customer_email=user.email,
                total_amount=str(amount_display),
                currency=str(payment.currency or "EUR"),
                payment_status=pay_status,
                duration_minutes=int(booking.duration),
                promo_applied=promo_applied,
                issued_at=payment.created_at or now,
            )
        )
    return out


def load_booking_invoice(
    db: Session,
    *,
    booking_id: str,
    user_id: str | None = None,
    mentor_id: str | None = None,
) -> BookingInvoiceOut:
    if not user_id and not mentor_id:
        raise InvoiceError("Forbidden")

    booking = (
        db.query(Booking)
        .options(joinedload(Booking.user), joinedload(Booking.mentor))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise InvoiceError("Booking not found")
    if user_id and booking.user_id != user_id:
        raise InvoiceError("Forbidden")
    if mentor_id and booking.mentor_id != mentor_id:
        raise InvoiceError("Forbidden")

    payment = _resolve_booking_payment(db, booking)
    if not payment:
        raise InvoiceError("Payment record not found for this booking")

    user: User = booking.user
    mentor: Mentor = booking.mentor
    bill_name = user.full_name or "Customer"
    m_name = mentor.full_name or "Coach"
    topic = booking.session_topic
    line_desc = f"Mentorship session ({booking.duration} min) with {m_name}"
    if topic:
        line_desc = f"{line_desc} — {topic}"

    amt_base = getattr(payment, "amount_base_eur", None)
    amount_display = Decimal(str(payment.amount)).quantize(Decimal("0.01"))

    pay_status = "paid" if str(payment.status) == PAYMENT_RECORD_SUCCEEDED else str(payment.status)

    return BookingInvoiceOut(
        invoice_number=booking_invoice_number(booking.id),
        issued_at=payment.created_at or datetime.now(timezone.utc),
        platform_legal_name=settings.app_name,
        platform_contact_email=_platform_contact(),
        booking_id=booking.id,
        session_start_at_utc=booking.start_at_utc,
        session_end_at_utc=booking.end_at_utc,
        duration_minutes=int(booking.duration),
        booking_status=str(booking.status),
        session_topic=topic,
        bill_to_name=bill_name,
        bill_to_email=user.email,
        mentor_name=m_name,
        mentor_email=mentor.email,
        line_description=line_desc,
        payment_status=pay_status,
        payment_currency=str(payment.currency or "EUR"),
        payment_amount=str(amount_display),
        amount_base_eur=str(Decimal(str(amt_base)).quantize(Decimal("0.01"))) if amt_base is not None else None,
        transaction_id=payment.transaction_id,
    )


def load_mentor_monthly_statement(
    db: Session,
    *,
    invoice_id: str,
    mentor_id: str,
) -> MentorMonthlyFeeStatementOut:
    inv = (
        db.query(MentorMonthlyInvoice)
        .filter(MentorMonthlyInvoice.id == invoice_id, MentorMonthlyInvoice.mentor_id == mentor_id)
        .first()
    )
    if not inv:
        raise InvoiceError("Invoice not found")
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor:
        raise InvoiceError("Coach not found")
    month_s = inv.invoice_month.isoformat() if inv.invoice_month else ""
    return MentorMonthlyFeeStatementOut(
        invoice_number=monthly_fee_invoice_number(inv.id, month_s),
        invoice_id=inv.id,
        issued_at=inv.created_at,
        platform_legal_name=settings.app_name,
        platform_contact_email=_platform_contact(),
        coach_name=mentor.full_name or "Coach",
        coach_email=mentor.email,
        invoice_month=month_s,
        gross_revenue=Decimal(str(inv.gross_revenue)),
        fee_percent=Decimal(str(inv.fee_percent)),
        fee_amount=Decimal(str(inv.fee_amount)),
        currency=str(inv.currency or "EUR"),
        status=str(inv.status),
        paid_at=inv.paid_at,
        created_at=inv.created_at,
        checkout_amount=Decimal(str(inv.checkout_amount)) if inv.checkout_amount is not None else None,
        checkout_currency=inv.checkout_currency,
        fee_fx_rate=Decimal(str(inv.fee_fx_rate)) if inv.fee_fx_rate is not None else None,
        mollie_payment_id=inv.mollie_payment_id,
    )


def load_mentor_onboarding_invoice(
    db: Session,
    *,
    payment_id: str,
    mentor_id: str,
) -> MentorOnboardingInvoiceOut:
    row = (
        db.query(MentorOnboardingPayment)
        .filter(MentorOnboardingPayment.id == payment_id, MentorOnboardingPayment.mentor_id == mentor_id)
        .first()
    )
    if not row:
        raise InvoiceError("Payment not found")
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor:
        raise InvoiceError("Coach not found")
    return MentorOnboardingInvoiceOut(
        invoice_number=onboarding_invoice_number(row.id),
        payment_id=row.id,
        issued_at=row.created_at,
        platform_legal_name=settings.app_name,
        platform_contact_email=_platform_contact(),
        coach_name=mentor.full_name or "Coach",
        coach_email=mentor.email,
        line_description="Coach onboarding fee (platform)",
        amount=Decimal(str(row.amount)),
        currency=str(row.currency or "EUR"),
        status=str(row.status),
        paid_at=row.paid_at,
        created_at=row.created_at,
        mollie_payment_id=row.mollie_payment_id,
    )
