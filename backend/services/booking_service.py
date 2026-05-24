from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from core.booking_states import PAYMENT_UNPAID, STATUS_PENDING_PAYMENT
from core.security import new_uuid
from models.availability_slot import AvailabilitySlot
from models.booking import Booking
from models.mentor import Mentor
from schemas.booking import BookingCreate
from services.chat_service import mentor_chat_busy
from services.i18n_service import to_i18n_map
from services.presence_service import presence_service
from services.pricing_service import PricingError, booking_base_eur_amount

ALLOWED_LIVE_DURATIONS = frozenset({5, 10, 20, 30})
ALLOWED_COMMUNICATION_MODES = frozenset({"video", "call"})


class BookingError(Exception):
    def __init__(self, message: str, code: str = "booking_error"):
        self.message = message
        self.code = code
        super().__init__(message)


def _booking_fields_from_payload(payload: BookingCreate) -> dict:
    return {
        "session_topic": payload.session_topic,
        "session_topic_i18n": payload.session_topic_i18n or to_i18n_map(payload.session_topic),
        "problem_description": payload.problem_description,
        "problem_description_i18n": payload.problem_description_i18n or to_i18n_map(payload.problem_description),
        "goals_expected": payload.goals_expected,
        "goals_expected_i18n": payload.goals_expected_i18n or to_i18n_map(payload.goals_expected),
        "experience_level": payload.experience_level,
        "communication_mode": payload.communication_mode,
        "urgency_level": payload.urgency_level,
        "preferred_language": payload.preferred_language,
        "attachments": payload.attachments,
    }


def _validate_mentor_for_booking(db: Session, mentor: Mentor | None) -> Mentor:
    if not mentor:
        raise BookingError("Mentor not found", "mentor_not_found")
    if not mentor.is_approved or mentor.status != "active":
        raise BookingError("Mentor is not available for booking", "mentor_inactive")
    if mentor_chat_busy(db, mentor.id):
        raise BookingError("Mentor is currently in a chat session", "mentor_in_chat")
    return mentor


def create_live_booking_request(db: Session, user_id: str, payload: BookingCreate) -> Booking:
    """Book an immediate live session when the coach is online on the platform."""
    if not payload.mentor_id or not payload.duration_minutes:
        raise BookingError("mentor_id and duration_minutes are required", "invalid_live_booking")

    duration = int(payload.duration_minutes)
    if duration not in ALLOWED_LIVE_DURATIONS:
        raise BookingError("Invalid session duration", "invalid_duration")

    communication_mode: str | None = None
    if payload.communication_mode:
        communication_mode = payload.communication_mode.strip().lower()
        if communication_mode not in ALLOWED_COMMUNICATION_MODES:
            raise BookingError("communication_mode must be video or call", "invalid_communication_mode")
    else:
        raise BookingError("communication_mode is required (video or call)", "communication_mode_required")

    mentor = _validate_mentor_for_booking(
        db,
        db.query(Mentor).filter(Mentor.id == payload.mentor_id).with_for_update().first(),
    )
    if not presence_service.is_online(mentor.id, "mentor"):
        raise BookingError(
            "Coach is offline. You can book a live session only while they are online on the platform.",
            "mentor_offline",
        )

    try:
        _amount = booking_base_eur_amount(db, mentor=mentor, duration_minutes=duration)
    except PricingError as e:
        raise BookingError(e.message, e.code) from e

    now = datetime.now(timezone.utc)
    end = now + timedelta(minutes=duration)

    slot = AvailabilitySlot(
        id=new_uuid(),
        mentor_id=mentor.id,
        slot_date=now.date(),
        start_time=now.time().replace(microsecond=0),
        end_time=end.time().replace(microsecond=0),
        start_at_utc=now,
        end_at_utc=end,
        slot_duration=duration,
        is_booked=False,
        is_recurring=False,
        created_at=now,
    )
    db.add(slot)
    db.flush()

    booking_fields = _booking_fields_from_payload(payload)
    booking_fields["communication_mode"] = communication_mode

    booking = Booking(
        id=new_uuid(),
        user_id=user_id,
        mentor_id=mentor.id,
        slot_id=slot.id,
        booking_date=now.date(),
        start_time=slot.start_time,
        end_time=slot.end_time,
        start_at_utc=now,
        end_at_utc=end,
        duration=duration,
        status=STATUS_PENDING_PAYMENT,
        payment_status=PAYMENT_UNPAID,
        payment_id=None,
        meeting_link=None,
        notes_by_user=None,
        notes_by_user_i18n=None,
        notes_by_mentor=None,
        notes_by_mentor_i18n=None,
        created_at=now,
        **booking_fields,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def create_slot_booking_request(db: Session, user_id: str, payload: BookingCreate) -> Booking:
    slot = (
        db.query(AvailabilitySlot)
        .filter(AvailabilitySlot.id == payload.slot_id)
        .with_for_update()
        .first()
    )
    if not slot:
        raise BookingError("Slot not found", "slot_not_found")
    if slot.is_booked:
        raise BookingError("Slot is no longer available", "slot_booked")
    mentor = _validate_mentor_for_booking(
        db,
        db.query(Mentor).filter(Mentor.id == slot.mentor_id).first(),
    )

    try:
        _amount = booking_base_eur_amount(db, mentor=mentor, duration_minutes=slot.slot_duration)
    except PricingError as e:
        raise BookingError(e.message, e.code) from e
    now = datetime.now(timezone.utc)

    booking = Booking(
        id=new_uuid(),
        user_id=user_id,
        mentor_id=mentor.id,
        slot_id=slot.id,
        booking_date=slot.slot_date,
        start_time=slot.start_time,
        end_time=slot.end_time,
        start_at_utc=slot.start_at_utc,
        end_at_utc=slot.end_at_utc,
        duration=slot.slot_duration,
        status=STATUS_PENDING_PAYMENT,
        payment_status=PAYMENT_UNPAID,
        payment_id=None,
        meeting_link=None,
        notes_by_user=None,
        notes_by_user_i18n=None,
        notes_by_mentor=None,
        notes_by_mentor_i18n=None,
        created_at=now,
        **_booking_fields_from_payload(payload),
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def create_booking_request(db: Session, user_id: str, payload: BookingCreate) -> Booking:
    if payload.mentor_id and payload.duration_minutes:
        return create_live_booking_request(db, user_id, payload)
    if payload.slot_id:
        return create_slot_booking_request(db, user_id, payload)
    raise BookingError("Provide mentor_id with duration_minutes for a live booking", "invalid_booking")
