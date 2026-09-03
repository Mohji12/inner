from sqlalchemy.orm import Session

from services.booking_invoice_pdf import build_booking_invoice_pdf_from_out
from services.invoice_errors import InvoiceError
from services.platform_invoice_service import load_booking_invoice


def generate_invoice_pdf(db: Session, booking_id: str, user_id: str) -> bytes:
    """Generates a PDF invoice for a given booking (customer copy)."""
    data = load_booking_invoice(db, booking_id=booking_id, user_id=user_id)
    return build_booking_invoice_pdf_from_out(data)


def generate_invoice_pdf_for_mentor(db: Session, booking_id: str, mentor_id: str) -> bytes:
    """Generates a PDF invoice for a given booking (coach copy — same totals, coach-facing)."""
    data = load_booking_invoice(db, booking_id=booking_id, mentor_id=mentor_id)
    return build_booking_invoice_pdf_from_out(data)
