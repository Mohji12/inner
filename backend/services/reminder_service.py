import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from db.session import SessionLocal
from models.booking import Booking
from services.notification_service import create_notification

logger = logging.getLogger(__name__)

def check_and_send_reminders():
    """Background task to send booking reminders"""
    logger.info("Running reminder check...")
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # 24 hour reminders
        upcoming_24h = now + timedelta(hours=24)
        bookings_24h = db.query(Booking).filter(
            Booking.status == "confirmed",
            Booking.reminder_24h_sent == False
        ).all()
        
        for b in bookings_24h:
            start_dt = b.start_at_utc
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            # If the booking is exactly or less than 24h away (and more than 1h away)
            if start_dt <= upcoming_24h and start_dt > now + timedelta(hours=1):
                # Send to user
                create_notification(
                    db,
                    user_id=b.user_id,
                    type="session_reminder",
                    title="Upcoming Session Tomorrow",
                    body=f"You have a session with {b.mentor.full_name} tomorrow at {b.start_time.strftime('%H:%M')}.",
                    link="/user/appointments"
                )
                # Send to mentor
                create_notification(
                    db,
                    mentor_id=b.mentor_id,
                    type="session_reminder",
                    title="Upcoming Session Tomorrow",
                    body=f"You have a session with {b.user.full_name} tomorrow at {b.start_time.strftime('%H:%M')}.",
                    link="/mentor/appointments"
                )
                b.reminder_24h_sent = True
        
        # 1 hour reminders
        upcoming_1h = now + timedelta(hours=1)
        bookings_1h = db.query(Booking).filter(
            Booking.status == "confirmed",
            Booking.reminder_1h_sent == False
        ).all()
        
        for b in bookings_1h:
            start_dt = b.start_at_utc
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            if start_dt <= upcoming_1h and start_dt > now + timedelta(minutes=15):
                create_notification(db, user_id=b.user_id, type="session_reminder", title="Session in 1 Hour", body=f"Your session starts in 1 hour.", link="/user/appointments")
                create_notification(db, mentor_id=b.mentor_id, type="session_reminder", title="Session in 1 Hour", body=f"Your session starts in 1 hour.", link="/mentor/appointments")
                b.reminder_1h_sent = True

        # 15 min reminders
        upcoming_15m = now + timedelta(minutes=15)
        bookings_15m = db.query(Booking).filter(
            Booking.status == "confirmed",
            Booking.reminder_15m_sent == False
        ).all()
        
        for b in bookings_15m:
            start_dt = b.start_at_utc
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            if start_dt <= upcoming_15m and start_dt > now:
                create_notification(db, user_id=b.user_id, type="session_reminder", title="Session starts soon!", body=f"Join your session now.", link="/user/appointments")
                create_notification(db, mentor_id=b.mentor_id, type="session_reminder", title="Session starts soon!", body=f"Join your session now.", link="/mentor/appointments")
                b.reminder_15m_sent = True

        db.commit()
    except Exception as e:
        logger.error(f"Error checking reminders: {e}")
    finally:
        db.close()
