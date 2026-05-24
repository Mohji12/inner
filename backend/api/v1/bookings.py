from fastapi import APIRouter, HTTPException, status
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from api.deps import CurrentMentor, CurrentUser, DbSession, RequestLang
from core.booking_states import STATUS_CANCELLED, STATUS_COMPLETED
from models.booking import Booking
from models.mentor import Mentor
from schemas.booking import BookingCreate, BookingOut, BookingUpdate
from services.booking_service import BookingError, create_booking_request
from services.i18n_service import resolve_i18n_text, to_i18n_map

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _localized_booking_out(booking: Booking, lang: str) -> BookingOut:
    out = BookingOut.model_validate(booking).model_dump()
    out["session_topic"] = resolve_i18n_text(getattr(booking, "session_topic_i18n", None), booking.session_topic, lang)
    out["problem_description"] = resolve_i18n_text(getattr(booking, "problem_description_i18n", None), booking.problem_description, lang)
    out["goals_expected"] = resolve_i18n_text(getattr(booking, "goals_expected_i18n", None), booking.goals_expected, lang)
    out["notes_by_user"] = resolve_i18n_text(getattr(booking, "notes_by_user_i18n", None), booking.notes_by_user, lang)
    out["notes_by_mentor"] = resolve_i18n_text(getattr(booking, "notes_by_mentor_i18n", None), booking.notes_by_mentor, lang)
    return BookingOut.model_validate(out)


def _booking_error_http(e: BookingError) -> HTTPException:
    code_map = {
        "slot_not_found": status.HTTP_404_NOT_FOUND,
        "slot_booked": status.HTTP_409_CONFLICT,
        "mentor_not_found": status.HTTP_404_NOT_FOUND,
        "mentor_inactive": status.HTTP_400_BAD_REQUEST,
        "mentor_in_chat": status.HTTP_409_CONFLICT,
        "mentor_offline": status.HTTP_409_CONFLICT,
        "invalid_duration": status.HTTP_400_BAD_REQUEST,
        "pricing_not_configured": status.HTTP_400_BAD_REQUEST,
        "pricing_inactive": status.HTTP_400_BAD_REQUEST,
    }
    st = code_map.get(e.code, status.HTTP_400_BAD_REQUEST)
    return HTTPException(st, detail=e.message)


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking_route(
    db: DbSession,
    user: CurrentUser,
    payload: BookingCreate,
    lang: RequestLang,
) -> BookingOut:
    try:
        booking = create_booking_request(db, user.id, payload)
    except BookingError as e:
        raise _booking_error_http(e) from e
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This slot was just booked. Please choose another time.",
        ) from e
    return _localized_booking_out(booking, lang)


@router.get("/me", response_model=list[BookingOut])
def list_my_bookings_user(db: DbSession, user: CurrentUser, lang: RequestLang) -> list[BookingOut]:
    rows = (
        db.query(Booking)
        .filter(Booking.user_id == user.id)
        .order_by(Booking.start_at_utc.desc())
        .all()
    )
    return [_localized_booking_out(b, lang) for b in rows]


@router.get("/mentor/me", response_model=list[BookingOut])
def list_my_bookings_mentor(db: DbSession, mentor: CurrentMentor, lang: RequestLang) -> list[BookingOut]:
    rows = (
        db.query(Booking)
        .filter(Booking.mentor_id == mentor.id)
        .order_by(Booking.start_at_utc.desc())
        .all()
    )
    return [_localized_booking_out(b, lang) for b in rows]


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking_for_user(booking_id: str, db: DbSession, user: CurrentUser, lang: RequestLang) -> BookingOut:
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == user.id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    return _localized_booking_out(booking, lang)


@router.patch("/{booking_id}/as-user", response_model=BookingOut)
def update_booking_as_user(
    booking_id: str,
    db: DbSession,
    user: CurrentUser,
    payload: BookingUpdate,
    lang: RequestLang,
) -> BookingOut:
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == user.id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    if payload.notes_by_user is not None:
        booking.notes_by_user = payload.notes_by_user
        booking.notes_by_user_i18n = payload.notes_by_user_i18n or to_i18n_map(payload.notes_by_user, lang)
    if payload.status == STATUS_CANCELLED:
        booking.status = STATUS_CANCELLED
    db.commit()
    db.refresh(booking)
    return _localized_booking_out(booking, lang)


@router.patch("/{booking_id}/as-mentor", response_model=BookingOut)
def update_booking_as_mentor(
    booking_id: str,
    db: DbSession,
    mentor: CurrentMentor,
    payload: BookingUpdate,
    lang: RequestLang,
) -> BookingOut:
    booking = (
        db.query(Booking).filter(Booking.id == booking_id, Booking.mentor_id == mentor.id).first()
    )
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    if payload.notes_by_mentor is not None:
        booking.notes_by_mentor = payload.notes_by_mentor
        booking.notes_by_mentor_i18n = payload.notes_by_mentor_i18n or to_i18n_map(payload.notes_by_mentor, lang)
    if payload.status == STATUS_COMPLETED:
        booking.status = STATUS_COMPLETED
        db.execute(
            update(Mentor)
            .where(Mentor.id == mentor.id)
            .values(total_sessions_completed=Mentor.total_sessions_completed + 1)
        )
    if payload.status == STATUS_CANCELLED:
        booking.status = STATUS_CANCELLED
    db.commit()
    db.refresh(booking)
    return _localized_booking_out(booking, lang)


@router.post("/{booking_id}/pay")
def pay_booking(booking_id: str, db: DbSession, user: CurrentUser):
    _ = (booking_id, db, user)
    raise HTTPException(
        status.HTTP_410_GONE,
        "Direct booking pay endpoint retired. Use /payments/create-intent for Mollie checkout.",
    )
