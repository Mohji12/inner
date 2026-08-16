"""Email the coach when a booking is paid and the session is ready to join."""
from __future__ import annotations

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from core.config import settings
from models.booking import Booking
from models.mentor import Mentor
from services.email_service import send_plain_email

logger = logging.getLogger(__name__)


def _frontend_base() -> str:
    return (settings.mollie_redirect_base_url or "https://mijnlevenspad.com").rstrip("/")


def _format_when(dt: datetime | None, timezone_name: str | None) -> str:
    if not dt:
        return "now"
    tz_name = (timezone_name or "Europe/Amsterdam").strip() or "Europe/Amsterdam"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("Europe/Amsterdam")
    local = dt if dt.tzinfo else dt.replace(tzinfo=ZoneInfo("UTC"))
    local = local.astimezone(tz)
    return f"{local.strftime('%Y-%m-%d %H:%M')} ({tz_name})"


def notify_coach_booking_confirmed(
    db: Session,
    *,
    booking: Booking,
    session_id: str | None,
    user_name: str,
    duration_minutes: int,
    comm_label: str,
) -> None:
    mentor = db.query(Mentor).filter(Mentor.id == booking.mentor_id).first()
    if not mentor or not (mentor.email or "").strip():
        return

    base = _frontend_base()
    join_url = f"{base}/mentor/chat/{session_id}" if session_id else f"{base}/mentor/appointments"
    when = _format_when(booking.start_at_utc, mentor.timezone)

    subject = "Booking confirmed — you can join the session"
    body = "\n".join(
        [
            f"Hello {mentor.full_name},",
            "",
            "A session has been booked and confirmed. You can join now.",
            "",
            f"Client: {user_name}",
            f"Duration: {duration_minutes} minutes",
            f"Mode: {comm_label}",
            f"When: {when}",
            "",
            "Join the session:",
            join_url,
            "",
            "You can also open it from Appointments in your coach dashboard:",
            f"{base}/mentor/appointments",
            "",
            "— Mijn Levenspad",
        ]
    )
    try:
        send_plain_email(to_email=mentor.email, subject=subject, body=body)
    except Exception:
        logger.exception(
            "Failed to email coach booking confirmation mentor_id=%s booking_id=%s",
            mentor.id,
            booking.id,
        )
