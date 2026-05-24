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
from schemas.platform_invoice import BookingInvoiceOut, MentorMonthlyFeeStatementOut, MentorOnboardingInvoiceOut
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
        .options(joinedload(Booking.user), joinedload(Booking.mentor), joinedload(Booking.payment))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise InvoiceError("Booking not found")
    if user_id and booking.user_id != user_id:
        raise InvoiceError("Forbidden")
    if mentor_id and booking.mentor_id != mentor_id:
        raise InvoiceError("Forbidden")

    payment = booking.payment
    if not payment:
        pay_row = db.query(Payment).filter(Payment.booking_id == booking_id).first()
        payment = pay_row
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
        payment_status=str(payment.status),
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
