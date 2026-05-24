import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from core.booking_states import (
    PAYMENT_PAID,
    PAYMENT_RECORD_SUCCEEDED,
    STATUS_CONFIRMED,
)
from core.security import new_uuid
from models.availability_slot import AvailabilitySlot
from models.booking import Booking
from models.mentor import Mentor
from models.payment import Payment
from services.pricing_service import booking_base_eur_amount


class PaymentError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def process_placeholder_payment(db: Session, *, user_id: str, booking_id: str) -> Payment:
    booking = db.query(Booking).filter(Booking.id == booking_id).with_for_update().first()
    if not booking:
        raise PaymentError("Booking not found")
    if booking.user_id != user_id:
        raise PaymentError("Forbidden")
    if booking.payment_status == PAYMENT_PAID:
        raise PaymentError("Already paid")

    slot = db.query(AvailabilitySlot).filter(AvailabilitySlot.id == booking.slot_id).first()
    if not slot:
        raise PaymentError("Slot missing")

    mentor = db.query(Mentor).filter(Mentor.id == booking.mentor_id).first()
    if not mentor:
        raise PaymentError("Mentor missing")
    amount = booking_base_eur_amount(db, mentor=mentor, duration_minutes=booking.duration)
    now = datetime.now(timezone.utc)
    txn = f"ph-{uuid.uuid4().hex[:16]}"

    payment = Payment(
        id=new_uuid(),
        user_id=user_id,
        booking_id=booking_id,
        amount=amount,
        currency="EUR",
        payment_gateway="placeholder",
        transaction_id=txn,
        status=PAYMENT_RECORD_SUCCEEDED,
        created_at=now,
    )
    booking.payment_status = PAYMENT_PAID
    booking.status = STATUS_CONFIRMED
    booking.payment_id = payment.id
    booking.meeting_link = f"https://meet.example.com/{booking.id[:8]}"

    slot.is_booked = True

    db.add(payment)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(payment)
    return payment
