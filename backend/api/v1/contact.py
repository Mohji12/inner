"""Public contact / support inquiry form."""

from __future__ import annotations

from fastapi import APIRouter, Request, status

from core.limiter import limiter
from schemas.contact import SupportContactCreate, SupportContactMessage
from services.support_inquiry_service import send_support_inquiry

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("/support", response_model=SupportContactMessage, status_code=status.HTTP_200_OK)
@limiter.limit("10/hour")
def submit_support_inquiry(request: Request, payload: SupportContactCreate) -> SupportContactMessage:
    send_support_inquiry(
        source="contact_page",
        full_name=payload.full_name,
        email=str(payload.email),
        subject=payload.subject,
        message=payload.message,
        phone=payload.phone,
        role=payload.role,
    )
    return SupportContactMessage(
        message="Thank you! Your message was sent. Our team will get back to you by email."
    )
