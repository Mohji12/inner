import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from api.deps import CurrentUser, DbSession
from models.waitlist import WaitlistEntry
from models.mentor import Mentor

router = APIRouter(prefix="/mentors", tags=["waitlist"])

@router.post("/{mentor_id}/waitlist")
def join_waitlist(mentor_id: str, current_user: CurrentUser, db: DbSession):
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")

    existing = db.query(WaitlistEntry).filter(
        WaitlistEntry.user_id == current_user.id,
        WaitlistEntry.mentor_id == mentor_id
    ).first()

    if existing:
        return {"status": "success", "message": "Already on the waitlist"}

    new_entry = WaitlistEntry(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        mentor_id=mentor_id,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30)
    )
    db.add(new_entry)
    db.commit()

    return {"status": "success", "message": "Successfully joined the waitlist"}

@router.delete("/{mentor_id}/waitlist")
def leave_waitlist(mentor_id: str, current_user: CurrentUser, db: DbSession):
    entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.user_id == current_user.id,
        WaitlistEntry.mentor_id == mentor_id
    ).first()

    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not on the waitlist")

    db.delete(entry)
    db.commit()

    return {"status": "success", "message": "Successfully left the waitlist"}

@router.get("/{mentor_id}/waitlist/position")
def get_waitlist_position(mentor_id: str, current_user: CurrentUser, db: DbSession):
    entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.user_id == current_user.id,
        WaitlistEntry.mentor_id == mentor_id
    ).first()

    if not entry:
        return {"position": None}

    # Count how many entries for this mentor were created before this user's entry
    position = db.query(WaitlistEntry).filter(
        WaitlistEntry.mentor_id == mentor_id,
        WaitlistEntry.created_at <= entry.created_at
    ).count()

    return {"position": position}
