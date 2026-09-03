import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from db.session import SessionLocal
from models.booking import Booking
from services.notification_service import create_notification

logger = logging.getLogger(__name__)

def check_no_shows():
    """Background task to detect unattended sessions"""
    logger.info("Running no-show check...")
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # Look for confirmed sessions where end_time + 15 mins has passed
        past_bookings = db.query(Booking).filter(
            Booking.status == "confirmed"
        ).all()
        
        for b in past_bookings:
            end_dt = datetime.combine(b.booking_date, b.end_time).replace(tzinfo=timezone.utc)
            grace_period = end_dt + timedelta(minutes=15)
            
            if now > grace_period:
                # For Phase 5 MVP, we just automatically mark as unattended.
                # In a real app we would check LiveKit room logs.
                b.status = "unattended"
                # If we don't know who missed it, we leave no_show_by as NULL
                
                create_notification(
                    db,
                    user_id=b.user_id,
                    type="session_unattended",
                    title="Session Marked as Unattended",
                    body=f"The session with {b.mentor.full_name} was marked as unattended.",
                    link="/user/appointments"
                )
                
                create_notification(
                    db,
                    mentor_id=b.mentor_id,
                    type="session_unattended",
                    title="Session Marked as Unattended",
                    body=f"The session with {b.user.full_name} was marked as unattended.",
                    link="/mentor/appointments"
                )
        
        db.commit()
    except Exception as e:
        logger.error(f"Error checking no-shows: {e}")
    finally:
        db.close()
