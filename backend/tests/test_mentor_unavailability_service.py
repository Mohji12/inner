from datetime import date, datetime, time, timezone
from types import SimpleNamespace

from schemas.unavailability import UnavailabilityCreate
from services.mentor_unavailability_service import KIND_ONE_OFF, KIND_WEEKLY, current_and_next, is_unavailable_now


def test_unavailability_create_schema_builds():
    body = UnavailabilityCreate(kind="one_off", date=date(2026, 8, 18), all_day=True)
    assert body.date == date(2026, 8, 18)
    weekly = UnavailabilityCreate(kind="weekly", weekday=6, all_day=True)
    assert weekly.weekday == 6


def test_mentor_public_out_drops_orm_unavailability_list():
    from decimal import Decimal

    from schemas.mentor import MentorPublicOut

    out = MentorPublicOut.model_validate(
        {
            "id": "mentor-1",
            "full_name": "Ada",
            "headline": None,
            "profile_image": None,
            "languages_spoken": None,
            "years_of_experience": 1,
            "expertise_areas": None,
            "skills": None,
            "average_rating": Decimal("4.0"),
            "total_reviews": 1,
            "total_sessions_completed": 0,
            "is_verified": False,
            "status": "active",
            "created_at": datetime(2026, 1, 1),
            "unavailability": [{"kind": "weekly", "all_day": True}],
        }
    )
    assert out.unavailability is None

    with_block = MentorPublicOut.model_validate(
        {
            "id": "mentor-2",
            "full_name": "Ada",
            "headline": None,
            "profile_image": None,
            "languages_spoken": None,
            "years_of_experience": 1,
            "expertise_areas": None,
            "skills": None,
            "average_rating": Decimal("4.0"),
            "total_reviews": 1,
            "total_sessions_completed": 0,
            "is_verified": False,
            "status": "active",
            "created_at": datetime(2026, 1, 1),
            "unavailability": {"kind": "weekly", "all_day": True},
        }
    )
    assert with_block.unavailability is not None
    assert with_block.unavailability.kind == "weekly"


def _row(**kwargs):
    defaults = {
        "kind": KIND_ONE_OFF,
        "all_day": False,
        "start_at_utc": None,
        "end_at_utc": None,
        "weekday": None,
        "start_time": None,
        "end_time": None,
        "timezone": "UTC",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_one_off_current_block():
    now = datetime(2026, 8, 17, 10, 0, tzinfo=timezone.utc)
    row = _row(
        start_at_utc=datetime(2026, 8, 17, 9, 0, tzinfo=timezone.utc),
        end_at_utc=datetime(2026, 8, 17, 16, 0, tzinfo=timezone.utc),
    )
    current, nxt = current_and_next([row], now=now)
    assert current is not None
    assert current.end_at == row.end_at_utc
    assert nxt is None
    assert is_unavailable_now([row], now=now)


def test_one_off_past_is_skipped():
    now = datetime(2026, 8, 17, 17, 0, tzinfo=timezone.utc)
    row = _row(
        start_at_utc=datetime(2026, 8, 17, 9, 0, tzinfo=timezone.utc),
        end_at_utc=datetime(2026, 8, 17, 16, 0, tzinfo=timezone.utc),
    )
    current, nxt = current_and_next([row], now=now)
    assert current is None
    assert nxt is None
    assert not is_unavailable_now([row], now=now)


def test_weekly_all_day_sunday():
    now = datetime(2026, 8, 16, 10, 0, tzinfo=timezone.utc)  # Sunday
    row = _row(kind=KIND_WEEKLY, all_day=True, weekday=6, timezone="UTC")
    current, nxt = current_and_next([row], now=now)
    assert current is not None
    assert current.kind == KIND_WEEKLY
    assert nxt is None


def test_weekly_next_occurrence():
    now = datetime(2026, 8, 17, 10, 0, tzinfo=timezone.utc)  # Monday
    row = _row(
        kind=KIND_WEEKLY,
        weekday=6,
        start_time=time(9, 0),
        end_time=time(12, 0),
        timezone="UTC",
    )
    current, nxt = current_and_next([row], now=now)
    assert current is None
    assert nxt is not None
    assert nxt.weekday == 6
    assert nxt.start_at is not None
    assert nxt.start_at > now
