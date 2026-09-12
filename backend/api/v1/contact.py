"""Public contact / support inquiry form."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from api.deps import DbSession
from core.limiter import limiter
from schemas.contact import SupportContactCreate, SupportContactMessage
from services.contact_anti_spam import evaluate_public_contact_spam
from services.support_inquiry_service import send_support_inquiry

router = APIRouter(prefix="/contact", tags=["contact"])

_SUCCESS = "Thank you! Your message was sent. Our team will get back to you by email."


@router.post("/support", response_model=SupportContactMessage, status_code=status.HTTP_200_OK)
@limiter.limit("5/hour")
def submit_support_inquiry(
    request: Request,
    payload: SupportContactCreate,
    db: DbSession,
) -> SupportContactMessage:
    spam = evaluate_public_contact_spam(
        full_name=payload.full_name,
        subject=payload.subject,
        message=payload.message,
        website=payload.website,
        form_started_at=payload.form_started_at,
    )
    if spam.blocked:
        if spam.silent:
            # Honeypot: pretend success so bots do not adapt.
            return SupportContactMessage(message=_SUCCESS)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Could not send your message. Please refresh the page and try again.",
        )

    send_support_inquiry(
        source="contact_page",
        full_name=payload.full_name,
        email=str(payload.email),
        subject=payload.subject,
        message=payload.message,
        phone=payload.phone,
        role=payload.role,
        db=db,
    )
    return SupportContactMessage(message=_SUCCESS)
