"""Booking → coach email helpers.

Automatic "session booked" emails to coaches are disabled.
Coaches are notified in-app (bell) only. Admins can still email coaches via
admin announcements (`admin_announcement_service`).
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from models.booking import Booking

logger = logging.getLogger(__name__)


def notify_coach_booking_confirmed(
    db: Session,
    *,
    booking: Booking,
    session_id: str | None,
    user_name: str,
    duration_minutes: int,
    comm_label: str,
) -> None:
    """No-op: booking confirmation emails to coaches are intentionally disabled."""
    logger.info(
        "Skipping coach booking email mentor_id=%s booking_id=%s session_id=%s "
        "(user=%s duration=%s mode=%s)",
        booking.mentor_id,
        booking.id,
        session_id,
        user_name,
        duration_minutes,
        comm_label,
    )
    # Keep signature for any legacy callers; do not send email.
    _ = db
