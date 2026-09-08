from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import get_db
from api.deps import RequestLang, get_current_mentor, get_current_user
from models.mentor import Mentor
from models.user import User
from schemas.platform_invoice import BookingInvoiceOut, BookingInvoiceSummaryOut
from services.invoice_pdf_i18n import t_invoice
from services.invoice_service import InvoiceError, generate_invoice_pdf, generate_invoice_pdf_for_mentor
from services.platform_invoice_service import list_user_booking_invoice_summaries, load_booking_invoice

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("/bookings", response_model=list[BookingInvoiceSummaryOut])
def list_my_booking_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: RequestLang = ...,
) -> list[BookingInvoiceSummaryOut]:
    return list_user_booking_invoice_summaries(db, current_user.id, lang=lang)


@router.get("/bookings/{booking_id}", response_model=BookingInvoiceOut)
def get_booking_invoice_json(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: RequestLang = ...,
) -> BookingInvoiceOut:
    try:
        return load_booking_invoice(db, booking_id=booking_id, user_id=current_user.id, lang=lang)
    except InvoiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/mentor/bookings/{booking_id}", response_model=BookingInvoiceOut)
def get_booking_invoice_json_for_mentor(
    booking_id: str,
    db: Session = Depends(get_db),
    current_mentor: Mentor = Depends(get_current_mentor),
    lang: RequestLang = ...,
) -> BookingInvoiceOut:
    try:
        return load_booking_invoice(db, booking_id=booking_id, mentor_id=current_mentor.id, lang=lang)
    except InvoiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{booking_id}/download")
def download_invoice(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: RequestLang = ...,
):
    try:
        pdf_bytes = generate_invoice_pdf(db, booking_id, current_user.id, lang=lang)
        prefix = t_invoice(lang, "filename_invoice")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={prefix}-{booking_id[:8]}.pdf"
            }
        )
    except InvoiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/mentor/{booking_id}/download")
def download_invoice_for_mentor(
    booking_id: str,
    db: Session = Depends(get_db),
    current_mentor: Mentor = Depends(get_current_mentor),
    lang: RequestLang = ...,
):
    try:
        pdf_bytes = generate_invoice_pdf_for_mentor(db, booking_id, current_mentor.id, lang=lang)
        prefix = t_invoice(lang, "filename_invoice")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={prefix}-{booking_id[:8]}-mentor.pdf"
            }
        )
    except InvoiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
