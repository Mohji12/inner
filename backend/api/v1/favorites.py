from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, HTTPException, status

from api.deps import CurrentUser, DbSession
from api.v1.mentors_public import _mentor_public_out
from models.user_favorite import UserFavorite
from models.mentor import Mentor
from schemas.mentor import MentorPublicOut
from services.chat_service import mentor_ids_with_live_chat
from services.pricing_service import get_platform_pricing

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.post("/{mentor_id}", status_code=status.HTTP_201_CREATED)
def add_favorite(mentor_id: str, current_user: CurrentUser, db: DbSession):
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")

    existing = db.query(UserFavorite).filter(
        UserFavorite.user_id == current_user.id,
        UserFavorite.mentor_id == mentor_id
    ).first()

    if existing:
        return {"message": "Already favorited"}

    fav = UserFavorite(
        id=uuid.uuid4().hex,
        user_id=current_user.id,
        mentor_id=mentor_id,
        created_at=datetime.now(timezone.utc)
    )
    db.add(fav)
    db.commit()
    return {"message": "Favorited successfully"}


@router.delete("/{mentor_id}", status_code=status.HTTP_200_OK)
def remove_favorite(mentor_id: str, current_user: CurrentUser, db: DbSession):
    existing = db.query(UserFavorite).filter(
        UserFavorite.user_id == current_user.id,
        UserFavorite.mentor_id == mentor_id
    ).first()

    if not existing:
        return {"message": "Not favorited"}

    db.delete(existing)
    db.commit()
    return {"message": "Unfavorited successfully"}


@router.get("", response_model=list[MentorPublicOut])
def get_favorites(current_user: CurrentUser, db: DbSession):
    favs = db.query(UserFavorite).filter(UserFavorite.user_id == current_user.id).all()
    mentor_ids = [f.mentor_id for f in favs]

    if not mentor_ids:
        return []

    mentors = db.query(Mentor).filter(Mentor.id.in_(mentor_ids)).all()
    busy = mentor_ids_with_live_chat(db)
    pricing_row = get_platform_pricing(db)
    active_pricing = bool(pricing_row.is_active)
    return [_mentor_public_out(m, busy, session_pricing_active=active_pricing) for m in mentors]
