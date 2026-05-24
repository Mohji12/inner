from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func
from pydantic import BaseModel
from typing import Any

from api.deps import CurrentUser, DbSession
from models.user import User
from models.booking import Booking
from models.payment import Payment
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from schemas.user import DateAmountPoint, UserOut, UserSpendingSeriesOut, UserUpdate
from core.booking_states import STATUS_CONFIRMED, STATUS_COMPLETED, PAYMENT_RECORD_SUCCEEDED
from services.timezone_service import TimezoneConversionError, validate_timezone_name

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def read_me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(db: DbSession, user: CurrentUser, payload: UserUpdate) -> User:
    data = payload.model_dump(exclude_unset=True)
    if "timezone" in data and data["timezone"] is not None:
        try:
            data["timezone"] = validate_timezone_name(data["timezone"])
        except TimezoneConversionError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    if "country_code" in data and data["country_code"] is not None:
        data["country_code"] = data["country_code"].strip().upper()[:2] or None
    for k, v in data.items():
        setattr(user, k, v)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user

class UserDashboardStats(BaseModel):
    upcoming_session: Any | None
    total_sessions: int
    total_spent: float
    active_chats: int

@router.get("/me/dashboard-stats", response_model=UserDashboardStats)
def get_user_dashboard_stats(db: DbSession, user: CurrentUser) -> UserDashboardStats:
    now = datetime.now(timezone.utc)
    
    # Next upcoming session
    upcoming = db.query(Booking).filter(
        Booking.user_id == user.id,
        Booking.status == STATUS_CONFIRMED,
        Booking.start_at_utc >= now
    ).order_by(Booking.start_at_utc.asc()).first()
    
    # Total completed sessions
    total_sessions = db.query(func.count(Booking.id)).filter(
        Booking.user_id == user.id,
        Booking.status == STATUS_COMPLETED
    ).scalar() or 0
    
    # Total spent
    total_spent = db.query(func.sum(Payment.amount)).filter(
        Payment.user_id == user.id,
        Payment.status == PAYMENT_RECORD_SUCCEEDED
    ).scalar() or 0.0
    
    # Active chats
    active_chats = db.query(func.count(ChatSession.id)).filter(
        ChatSession.user_id == user.id,
        ChatSession.status == "active",
        ChatSession.ends_at > now
    ).scalar() or 0
    
    upcoming_data = None
    if upcoming:
        upcoming_data = {
            "id": upcoming.id,
            "mentor_name": upcoming.mentor.first_name + " " + upcoming.mentor.last_name if hasattr(upcoming.mentor, 'first_name') else "Coach",
            "date": upcoming.start_at_utc.date().isoformat(),
            "start_time": upcoming.start_at_utc.time().isoformat()
        }
        
    return UserDashboardStats(
        upcoming_session=upcoming_data,
        total_sessions=total_sessions,
        total_spent=float(total_spent),
        active_chats=active_chats
    )


Period = str


def _period_bounds(period: Period) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    if period == "day":
        start = end - timedelta(days=1)
    elif period == "week":
        start = end - timedelta(days=7)
    elif period == "month":
        start = end - timedelta(days=30)
    elif period == "year":
        start = end - timedelta(days=365)
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid period")
    return start, end


@router.get("/me/spending-series", response_model=UserSpendingSeriesOut)
def user_spending_series(
    db: DbSession,
    user: CurrentUser,
    period: str = Query("month"),
) -> UserSpendingSeriesOut:
    start, end = _period_bounds(period)
    day = func.date(Payment.created_at)

    pay_rows = (
        db.query(day, func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.user_id == user.id)
        .filter(Payment.created_at >= start, Payment.created_at <= end)
        .filter(Payment.status == PAYMENT_RECORD_SUCCEEDED)
        .group_by(day)
        .order_by(day)
        .all()
    )
    bookings_by_day = [
        DateAmountPoint(date=(d.isoformat() if hasattr(d, "isoformat") else str(d)), amount=str(amt))
        for d, amt in pay_rows
        if d is not None
    ]

    chat_day = func.date(ChatPurchase.created_at)
    chat_rows = (
        db.query(chat_day, func.coalesce(func.sum(ChatPurchase.amount), 0))
        .filter(ChatPurchase.user_id == user.id)
        .filter(ChatPurchase.created_at >= start, ChatPurchase.created_at <= end)
        .filter(ChatPurchase.status.in_(["succeeded", "paid", "completed"]))
        .group_by(chat_day)
        .order_by(chat_day)
        .all()
    )
    chat_by_day = [
        DateAmountPoint(date=(d.isoformat() if hasattr(d, "isoformat") else str(d)), amount=str(amt))
        for d, amt in chat_rows
        if d is not None
    ]

    return UserSpendingSeriesOut(
        period=period,
        range_start=start,
        range_end=end,
        bookings_by_day=bookings_by_day,
        chat_by_day=chat_by_day,
    )
