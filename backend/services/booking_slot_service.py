"""Slot availability helpers — which bookings block slots and cleanup on cancel/expire."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from core.booking_states import (
    PAYMENT_UNPAID,
    STATUS_CANCELLED,
    STATUS_CONFIRMED,
    STATUS_PENDING_PAYMENT,
)
from models.availability_slot import AvailabilitySlot
from models.booking import Booking

# Bookings in these statuses still reserve their slot.
SLOT_BLOCKING_STATUSES = frozenset(
    {
        STATUS_PENDING_PAYMENT,
        STATUS_CONFIRMED,
        "unattended",
    }
)

STALE_PENDING_PAYMENT_HOURS = 2


def active_booking_exists_on_slot(db: Session, slot_id: str, *, exclude_booking_id: str | None = None) -> bool:
    q = db.query(Booking.id).filter(
        Booking.slot_id == slot_id,
        Booking.status.in_(SLOT_BLOCKING_STATUSES),
    )
    if exclude_booking_id:
        q = q.filter(Booking.id != exclude_booking_id)
    return db.query(q.exists()).scalar() or False


def release_booking_slot(db: Session, booking: Booking) -> None:
    if not booking.slot_id:
        return
    slot = db.query(AvailabilitySlot).filter(AvailabilitySlot.id == booking.slot_id).first()
    if slot:
        slot.is_booked = False


def expire_stale_pending_bookings(db: Session) -> int:
    """Cancel unpaid pending_payment bookings older than STALE_PENDING_PAYMENT_HOURS and free slots."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=STALE_PENDING_PAYMENT_HOURS)
    stale = (
        db.query(Booking)
        .filter(
            Booking.status == STATUS_PENDING_PAYMENT,
            Booking.payment_status == PAYMENT_UNPAID,
            Booking.created_at < cutoff,
        )
        .all()
    )
    if not stale:
        return 0

    count = 0
    for booking in stale:
        booking.status = STATUS_CANCELLED
        release_booking_slot(db, booking)
        count += 1
    db.commit()
    return count
