"""Coach manual occupied flag and shared chat-availability helpers."""

from sqlalchemy.orm import Session

from models.mentor import Mentor


def mentor_manual_occupied(db: Session, mentor_id: str) -> bool:
    row = db.query(Mentor.manual_occupied).filter(Mentor.id == mentor_id).first()
    return bool(row and row[0])


def compute_chat_available(
    *,
    online: bool,
    busy: bool,
    unavailable_schedule: bool,
    manual_occupied: bool,
) -> bool:
    return online and not busy and not unavailable_schedule and not manual_occupied
