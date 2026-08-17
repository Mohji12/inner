"""Evaluate coach time-off rows (one-off UTC ranges and weekly local days)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from models.mentor_unavailability import MentorUnavailability
from services.timezone_service import date_time_to_utc, validate_timezone_name

KIND_ONE_OFF = "one_off"
KIND_WEEKLY = "weekly"


@dataclass(frozen=True)
class UnavailabilitySnapshot:
    kind: str
    all_day: bool
    weekday: int | None
    start_at: datetime | None
    end_at: datetime | None
    start_time: time | None
    end_time: time | None


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(validate_timezone_name(name or "UTC"))
    except Exception:
        return ZoneInfo("UTC")


def _end_of_local_day(local_date: date, tz: ZoneInfo) -> datetime:
    return datetime.combine(local_date, time(23, 59, 59), tzinfo=tz).astimezone(timezone.utc)


def weekly_bounds(row: MentorUnavailability, local_date: date) -> tuple[datetime, datetime]:
    tz = _zone(row.timezone)
    if row.all_day:
        start = datetime.combine(local_date, time.min, tzinfo=tz).astimezone(timezone.utc)
        end = _end_of_local_day(local_date, tz)
        return start, end
    start_t = row.start_time or time.min
    end_t = row.end_time or time(23, 59, 59)
    start = datetime.combine(local_date, start_t, tzinfo=tz).astimezone(timezone.utc)
    end = datetime.combine(local_date, end_t, tzinfo=tz).astimezone(timezone.utc)
    return start, end


def occurrence_for_weekly(row: MentorUnavailability, now: datetime) -> tuple[datetime, datetime] | None:
    if row.weekday is None:
        return None
    tz = _zone(row.timezone)
    now_utc = _aware(now)
    now_local = now_utc.astimezone(tz)
    for delta in range(0, 8):
        local_date = now_local.date() + timedelta(days=delta)
        if local_date.weekday() != int(row.weekday):
            continue
        start, end = weekly_bounds(row, local_date)
        if now_utc < end:
            return start, end
    return None


def snapshot_from_row(row: MentorUnavailability, start_at: datetime | None, end_at: datetime | None) -> UnavailabilitySnapshot:
    return UnavailabilitySnapshot(
        kind=row.kind,
        all_day=bool(row.all_day),
        weekday=row.weekday,
        start_at=_aware(start_at) if start_at else None,
        end_at=_aware(end_at) if end_at else None,
        start_time=row.start_time,
        end_time=row.end_time,
    )


def current_and_next(
    rows: list[MentorUnavailability],
    *,
    now: datetime | None = None,
) -> tuple[UnavailabilitySnapshot | None, UnavailabilitySnapshot | None]:
    now_utc = _aware(now or datetime.now(timezone.utc))
    currents: list[tuple[datetime, UnavailabilitySnapshot]] = []
    upcoming: list[tuple[datetime, UnavailabilitySnapshot]] = []

    for row in rows:
        if row.kind == KIND_ONE_OFF:
            if not row.start_at_utc or not row.end_at_utc:
                continue
            start = _aware(row.start_at_utc)
            end = _aware(row.end_at_utc)
            snap = snapshot_from_row(row, start, end)
            if start <= now_utc < end:
                currents.append((end, snap))
            elif start > now_utc:
                upcoming.append((start, snap))
            continue
        if row.kind == KIND_WEEKLY:
            occ = occurrence_for_weekly(row, now_utc)
            if not occ:
                continue
            start, end = occ
            snap = snapshot_from_row(row, start, end)
            if start <= now_utc < end:
                currents.append((end, snap))
            elif start > now_utc:
                upcoming.append((start, snap))

    current = min(currents, key=lambda item: item[0])[1] if currents else None
    nxt = min(upcoming, key=lambda item: item[0])[1] if upcoming else None
    return current, nxt


def is_unavailable_now(rows: list[MentorUnavailability], *, now: datetime | None = None) -> bool:
    current, _ = current_and_next(rows, now=now)
    return current is not None


def public_block_for_rows(rows: list[MentorUnavailability], *, now: datetime | None = None) -> tuple[bool, UnavailabilitySnapshot | None]:
    current, nxt = current_and_next(rows, now=now)
    return current is not None, current or nxt


def load_unavailability_by_mentor(db: Session, mentor_ids: list[str]) -> dict[str, list[MentorUnavailability]]:
    if not mentor_ids:
        return {}
    rows = (
        db.query(MentorUnavailability)
        .filter(MentorUnavailability.mentor_id.in_(mentor_ids))
        .all()
    )
    grouped: dict[str, list[MentorUnavailability]] = {mid: [] for mid in mentor_ids}
    for row in rows:
        grouped.setdefault(row.mentor_id, []).append(row)
    return grouped


def list_active_for_mentor(db: Session, mentor_id: str, *, now: datetime | None = None) -> list[MentorUnavailability]:
    """Weekly rows plus one-offs that have not ended."""
    now_utc = _aware(now or datetime.now(timezone.utc))
    rows = db.query(MentorUnavailability).filter(MentorUnavailability.mentor_id == mentor_id).all()
    out: list[MentorUnavailability] = []
    for row in rows:
        if row.kind == KIND_WEEKLY:
            out.append(row)
            continue
        if row.end_at_utc and _aware(row.end_at_utc) > now_utc:
            out.append(row)
    return out


def mentor_unavailable_now(db: Session, mentor_id: str, *, now: datetime | None = None) -> bool:
    rows = load_unavailability_by_mentor(db, [mentor_id]).get(mentor_id, [])
    return is_unavailable_now(rows, now=now)


def one_off_bounds(*, off_date: date, all_day: bool, start_time: time | None, end_time: time | None, tz_name: str) -> tuple[datetime, datetime]:
    if all_day:
        start = date_time_to_utc(off_date, time.min, tz_name)
        end = date_time_to_utc(off_date, time(23, 59, 59), tz_name)
        return start, end
    if start_time is None or end_time is None:
        raise ValueError("Start and end times are required unless the day is all-day")
    start = date_time_to_utc(off_date, start_time, tz_name)
    end = date_time_to_utc(off_date, end_time, tz_name)
    return start, end
