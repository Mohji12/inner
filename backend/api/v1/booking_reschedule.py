from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timezone

from api.deps import CurrentUser, DbSession
from models.booking import Booking
from models.availability_slot import AvailabilitySlot

router = APIRouter(prefix="/bookings", tags=["bookings-reschedule"])

class RescheduleIn(BaseModel):
    new_slot_id: str

@router.post("/{booking_id}/reschedule")
def reschedule_booking(booking_id: str, payload: RescheduleIn, current_user: CurrentUser, db: DbSession):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")

    if booking.user_id != current_user.id and booking.mentor_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to reschedule this booking")

    if booking.status not in ("confirmed", "unattended"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Only confirmed or unattended bookings can be rescheduled",
        )

    start_dt = booking.start_at_utc
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    # Confirmed: reschedule only before the scheduled start (instant rules).
    # Unattended (no-show): allow picking a new slot even after the original window.
    if booking.status == "confirmed" and now >= start_dt:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Booking can only be rescheduled before session start time")

    if booking.reschedule_count >= 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Booking has reached the maximum number of reschedules (2)")

    # Find new slot
    new_slot = db.query(AvailabilitySlot).filter(
        AvailabilitySlot.id == payload.new_slot_id,
        AvailabilitySlot.mentor_id == booking.mentor_id,
        AvailabilitySlot.is_booked == False
    ).first()

    if not new_slot:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The selected slot is no longer available")

    # Free old slot
    old_slot = db.query(AvailabilitySlot).filter(AvailabilitySlot.id == booking.slot_id).first()
    if old_slot:
        old_slot.is_booked = False

    # Assign new slot
    new_slot.is_booked = True
    booking.slot_id = new_slot.id
    booking.booking_date = new_slot.slot_date
    booking.start_time = new_slot.start_time
    booking.end_time = new_slot.end_time
    booking.start_at_utc = new_slot.start_at_utc
    booking.end_at_utc = new_slot.end_at_utc
    booking.reschedule_count += 1
    booking.reminder_24h_sent = False
    booking.reminder_1h_sent = False
    booking.reminder_15m_sent = False

    db.commit()
    db.refresh(booking)
    
    return {"status": "success", "message": "Booking rescheduled successfully"}
