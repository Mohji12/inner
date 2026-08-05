"""Shared support-inquiry email fan-out for contact / user / coach forms."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import HTTPException, status

from core.config import settings
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
) -> None:
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
    errors: list[str] = []
    for to_email in recipients:
        try:
            send_plain_email(to_email=to_email, subject=mail_subject, body=body)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to send support email to %s", to_email)
            errors.append(str(exc))

    if len(errors) == len(recipients):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Could not send your message right now. Please try again or email info@mijnlevenspad.com.",
        )
