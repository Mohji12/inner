"""Notify admins when a new coach completes email verification (pending approval)."""
from __future__ import annotations

import logging
from typing import Any

from core.config import settings
from models.mentor import Mentor
from services.email_service import send_plain_email

logger = logging.getLogger(__name__)


def _list_field(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, list):
        items = [str(x).strip() for x in value if str(x).strip()]
        return ", ".join(items) if items else "—"
    text = str(value).strip()
    return text or "—"


def _notify_recipients() -> list[str]:
    raw = (settings.coach_registration_notify_emails or "").strip()
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def build_new_coach_registration_email_body(mentor: Mentor) -> str:
    bio = (mentor.bio or "").strip()
    if len(bio) > 500:
        bio = bio[:497] + "..."
    registered_at = mentor.created_at.isoformat() if mentor.created_at else "—"
    return "\n".join(
        [
            "A new coach has completed email verification and is awaiting admin approval.",
            "",
            f"Mentor ID: {mentor.id}",
            f"Full name: {mentor.full_name}",
            f"Email: {mentor.email}",
            f"Phone: {mentor.phone_number}",
            f"KVK number: {mentor.kvk_number or '—'}",
            f"Company: {mentor.current_company or '—'}",
            f"Headline: {mentor.headline or '—'}",
            f"Years of experience: {mentor.years_of_experience}",
            f"Languages: {_list_field(mentor.languages_spoken)}",
            f"Expertise: {_list_field(mentor.expertise_areas)}",
            f"Registered at (UTC): {registered_at}",
            f"Status: {mentor.status}",
            f"Approved: {mentor.is_approved}",
            "",
            "Bio:",
            bio or "—",
            "",
            "Please review and approve or reject this coach in the admin dashboard.",
        ]
    )


def notify_admins_new_coach_registration(mentor: Mentor) -> None:
    recipients = _notify_recipients()
    if not recipients:
        logger.info("No coach registration notify emails configured; skipping admin notification")
        return
    subject = f"New coach registration pending approval: {mentor.full_name}"
    body = build_new_coach_registration_email_body(mentor)
    for to_email in recipients:
        try:
            send_plain_email(to_email=to_email, subject=subject, body=body)
        except Exception:
            logger.exception("Failed to send coach registration notification to %s", to_email)
