"""Shared support-inquiry email fan-out for contact / user / coach forms."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings
from core.security import new_uuid
from models.support_inquiry import SupportInquiry
from services.email_service import send_plain_email

logger = logging.getLogger(__name__)

SupportSource = Literal["contact_page", "user_dashboard", "coach_dashboard"]

_SOURCE_LABEL = {
    "contact_page": "website contact form",
    "user_dashboard": "user dashboard support form",
    "coach_dashboard": "coach dashboard support form",
}

_SUBJECT_PREFIX = {
    "contact_page": "[Support · Contact]",
    "user_dashboard": "[Support · User]",
    "coach_dashboard": "[Support · Coach]",
}

_FROM_NAME_SUFFIX = {
    "contact_page": "via Contact",
    "user_dashboard": "via User support",
    "coach_dashboard": "via Coach support",
}


def support_recipients() -> list[str]:
    raw = (settings.support_contact_emails or "").strip()
    if not raw:
        raw = settings.coach_registration_notify_emails or ""
    seen: set[str] = set()
    out: list[str] = []
    for part in raw.split(","):
        email = part.strip()
        if not email:
            continue
        key = email.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(email)
    return out


def _support_from_display_name(*, source: SupportSource, full_name: str) -> str:
    name = (full_name or "").strip() or "Unknown"
    return f"{name} {_FROM_NAME_SUFFIX[source]}"


def build_support_email_body(
    *,
    source: SupportSource,
    full_name: str,
    email: str,
    subject: str,
    message: str,
    phone: str | None = None,
    role: str | None = None,
    account_id: str | None = None,
) -> str:
    lines = [
        f"New support inquiry from the {_SOURCE_LABEL[source]}.",
        "",
        "Reply to this email to answer the sender directly (Reply-To is set).",
        "",
        f"Name: {full_name.strip()}",
        f"Email: {email.strip()}",
        f"Phone: {(phone or '').strip() or '—'}",
    ]
    if role:
        lines.append(f"Role: {role}")
    if account_id:
        lines.append(f"Account ID: {account_id}")
    lines.extend(
        [
            f"Subject: {subject.strip()}",
            "",
            "Message:",
            message.strip(),
        ]
    )
    return "\n".join(lines)


def send_support_inquiry(
    *,
    source: SupportSource,
    full_name: str,
    email: str,
    subject: str,
    message: str,
    phone: str | None = None,
    role: str | None = None,
    account_id: str | None = None,
    db: Session | None = None,
) -> str:
    """Persist inquiry (when db given) and email support recipients. Returns inquiry id.

    Delivered via platform SMTP, but From display name + Reply-To use the user/coach
    so support_contact_emails can reply directly to them.
    """
    inquiry_id = new_uuid()
    if db is not None:
        row = SupportInquiry(
            id=inquiry_id,
            source=source,
            full_name=full_name.strip(),
            email=email.strip(),
            phone=(phone or "").strip() or None,
            role=role,
            account_id=account_id,
            subject=subject.strip(),
            message=message.strip(),
            status="new",
            created_at=datetime.now(timezone.utc),
        )
        db.add(row)
        db.commit()

    recipients = support_recipients()
    if not recipients:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Support inbox is not configured. Please email info@mijnlevenspad.com directly.",
        )

    mail_subject = f"{_SUBJECT_PREFIX[source]} {subject.strip()[:120]}"
    body = build_support_email_body(
        source=source,
        full_name=full_name,
        email=email,
        subject=subject,
        message=message,
        phone=phone,
        role=role,
        account_id=account_id,
    )
    reply_to = (email or "").strip()
    from_name = _support_from_display_name(source=source, full_name=full_name)
    errors: list[str] = []
    for to_email in recipients:
        try:
            send_plain_email(
                to_email=to_email,
                subject=mail_subject,
                body=body,
                reply_to=reply_to,
                from_name=from_name,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to send support email to %s", to_email)
            errors.append(str(exc))

    if len(errors) == len(recipients):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Could not send your message right now. Please try again or email info@mijnlevenspad.com.",
        )
    return inquiry_id
