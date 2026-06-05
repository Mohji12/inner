from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

from api.deps import DbSession
from core.limiter import limiter
from core.security import new_uuid
from models.coach_application import CoachApplication
from schemas.coach_application import CoachApplicationCreate, CoachApplicationMessage

router = APIRouter(prefix="/coach-applications", tags=["coach-applications"])


def _normalize_languages(raw: list[str] | None) -> list[str] | None:
    if not raw:
        return None
    cleaned = [part.strip() for item in raw for part in item.split(",") if part.strip()]
    return cleaned or None


@router.post("/", response_model=CoachApplicationMessage, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def submit_coach_application(request: Request, db: DbSession, payload: CoachApplicationCreate) -> CoachApplicationMessage:
    email = str(payload.email).lower().strip()
    now = datetime.now(timezone.utc)
    row = CoachApplication(
        id=new_uuid(),
        full_name=payload.full_name.strip(),
        email=email,
        phone_number=payload.phone_number.strip(),
        headline=payload.headline.strip(),
        motivation=payload.motivation.strip(),
        years_of_experience=payload.years_of_experience,
        languages_spoken=_normalize_languages(payload.languages_spoken),
        website_or_social=(payload.website_or_social.strip()[:512] or None)
        if payload.website_or_social
        else None,
        status="new",
        admin_notes=None,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save your application. Please try again.",
        ) from exc
    return CoachApplicationMessage(
        message="Thank you! Your coach application was submitted. Our team will review it and contact you by email."
    )
