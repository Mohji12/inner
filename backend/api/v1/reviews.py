from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status

from api.deps import CurrentUser, DbSession, RequestLang
from core.booking_states import PAYMENT_PAID, PAYMENT_RECORD_SUCCEEDED, STATUS_COMPLETED
from core.security import new_uuid
from models.booking import Booking
from models.mentor import Mentor
from models.review import Review
from schemas.review import ReviewCreate, ReviewOut
from services.i18n_service import resolve_i18n_text, to_i18n_map

router = APIRouter(prefix="/bookings", tags=["reviews"])


@router.post("/{booking_id}/review", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    booking_id: str,
    db: DbSession,
    user: CurrentUser,
    payload: ReviewCreate,
    lang: RequestLang,
) -> ReviewOut:
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == user.id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    if booking.status != STATUS_COMPLETED or booking.payment_status != PAYMENT_PAID:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Booking must be completed and paid")
    pay = booking.payment
    if not pay or pay.status != PAYMENT_RECORD_SUCCEEDED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment not completed")
    if db.query(Review).filter(Review.booking_id == booking_id).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Review already exists")

    mentor = db.query(Mentor).filter(Mentor.id == booking.mentor_id).first()
    if not mentor:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Coach missing")

    now = datetime.now(timezone.utc)
    review = Review(
        id=new_uuid(),
        user_id=user.id,
        mentor_id=booking.mentor_id,
        booking_id=booking_id,
        rating=payload.rating,
        review_text=payload.review_text,
        review_text_i18n=payload.review_text_i18n or to_i18n_map(payload.review_text, lang),
        created_at=now,
    )
    tr = mentor.total_reviews or 0
    ar = mentor.average_rating or Decimal("0")
    new_total = tr + 1
    new_avg = (ar * tr + Decimal(payload.rating)) / new_total
    mentor.total_reviews = new_total
    mentor.average_rating = new_avg.quantize(Decimal("0.01"))

    db.add(review)
    db.commit()
    db.refresh(review)
    out = ReviewOut.model_validate(review).model_dump()
    out["review_text"] = resolve_i18n_text(getattr(review, "review_text_i18n", None), review.review_text, lang)
    return ReviewOut.model_validate(out)
