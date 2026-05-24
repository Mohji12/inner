from fastapi import APIRouter, HTTPException, status, Response
from icalendar import Calendar, Event, vCalAddress, vText
import uuid
from datetime import datetime, timezone

from api.deps import CurrentUser, DbSession
from models.booking import Booking

router = APIRouter(prefix="/bookings", tags=["bookings-calendar"])

@router.get("/{booking_id}/ical")
def download_ical(booking_id: str, current_user: CurrentUser, db: DbSession):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")

    if booking.user_id != current_user.id and booking.mentor_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to access this booking")

    if booking.status != "confirmed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only confirmed bookings can be synced")

    cal = Calendar()
    cal.add('prodid', '-//Inner Path Mentor Booking//innerpath.com//')
    cal.add('version', '2.0')

    event = Event()
    
    # Calculate datetime
    start_dt = booking.start_at_utc
    end_dt = booking.end_at_utc
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=timezone.utc)

    event.add('summary', f"Coaching Session with {booking.mentor.full_name if current_user.id == booking.user_id else booking.user.full_name}")
    event.add('dtstart', start_dt)
    event.add('dtend', end_dt)
    event.add('dtstamp', datetime.now(timezone.utc))
    event.add('uid', f"{booking.id}@innerpath.com")
    
    description = f"Topic: {booking.session_topic or 'General Session'}\n"
    if booking.meeting_link:
        description += f"Meeting Link: {booking.meeting_link}\n"
    event.add('description', description)

    cal.add_component(event)

    ical_data = cal.to_ical()
    filename = f"booking_{booking.id}.ics"
    
    return Response(
        content=ical_data,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
