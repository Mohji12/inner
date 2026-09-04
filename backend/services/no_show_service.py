import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from db.session import SessionLocal
from models.booking import Booking
from services.live_session_service import booking_was_coach_no_show, classify_booking_no_show
from services.notification_service import create_notification
from services.promo_service import reverse_promo_redemption_for_booking

logger = logging.getLogger(__name__)


def _booking_end_utc(booking: Booking) -> datetime:
    if booking.end_at_utc is not None:
        end = booking.end_at_utc
        if end.tzinfo is None:
            return end.replace(tzinfo=timezone.utc)
        return end.astimezone(timezone.utc)
    return datetime.combine(booking.booking_date, booking.end_time).replace(tzinfo=timezone.utc)


def mark_booking_unattended(
    db: Session,
    booking: Booking,
    *,
    no_show_by: str | None = None,
    restore_promo_on_coach_miss: bool = True,
) -> bool:
    """
    Mark a booking unattended. When the coach missed (user joined, coach did not),
    restore any promo redemption tied to this booking so WELCOME5 can be reused.
    """
    if booking.status == "unattended":
        return False

    who = no_show_by or classify_booking_no_show(db, booking)
    booking.status = "unattended"
    if who in ("mentor", "user", "both"):
        booking.no_show_by = who

    restored = False
    if restore_promo_on_coach_miss and (who == "mentor" or booking_was_coach_no_show(db, booking)):
        restored = reverse_promo_redemption_for_booking(db, booking.id, commit=False)
        if restored:
            logger.info(
                "Restored promo redemption for booking %s after coach no-show",
                booking.id,
            )

    mentor_name = booking.mentor.full_name if booking.mentor else "your coach"
    user_name = booking.user.full_name if booking.user else "the user"

    create_notification(
        db,
        user_id=booking.user_id,
        type="session_unattended",
        title="Session Marked as Unattended",
        body=f"The session with {mentor_name} was marked as unattended.",
        link="/user/appointments",
        commit=False,
    )

    create_notification(
        db,
        mentor_id=booking.mentor_id,
        type="session_unattended",
        title="Session Marked as Unattended",
        body=f"The session with {user_name} was marked as unattended.",
        link="/mentor/appointments",
        commit=False,
    )
    return True


def check_no_shows():
    """Background task to detect unattended sessions"""
    logger.info("Running no-show check...")
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        past_bookings = db.query(Booking).filter(Booking.status == "confirmed").all()

        for b in past_bookings:
            grace_period = _booking_end_utc(b) + timedelta(minutes=15)

            if now > grace_period:
                mark_booking_unattended(db, b)

        db.commit()
    except Exception as e:
        logger.error(f"Error checking no-shows: {e}")
        db.rollback()
    finally:
        db.close()
