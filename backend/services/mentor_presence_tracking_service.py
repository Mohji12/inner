"""Track coach time-on-platform from presence heartbeats; weekly minimum warnings."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from core.config import settings
from core.security import new_uuid
from models.mentor import Mentor
from models.mentor_presence_week import MentorPresenceWeek
from services.email_service import send_plain_email

logger = logging.getLogger(__name__)


def presence_tz() -> ZoneInfo:
    return ZoneInfo(settings.mentor_presence_timezone or "Europe/Amsterdam")


def week_start_for(dt: datetime | None = None) -> date:
    """Monday date of the calendar week containing `dt` in the configured timezone."""
    now = dt or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    local = now.astimezone(presence_tz())
    return local.date() - timedelta(days=local.weekday())


def min_weekly_seconds() -> int:
    hours = float(settings.mentor_weekly_min_hours or 20)
    return max(0, int(hours * 3600))


def max_credit_seconds() -> int:
    return max(1, int(settings.mentor_presence_max_credit_seconds or 45))


def hours_from_seconds(seconds: int) -> float:
    return round(max(0, int(seconds)) / 3600.0, 2)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_or_create_week_row(db: Session, *, mentor_id: str, week_start: date) -> MentorPresenceWeek:
    row = (
        db.query(MentorPresenceWeek)
        .filter(
            MentorPresenceWeek.mentor_id == mentor_id,
            MentorPresenceWeek.week_start == week_start,
        )
        .first()
    )
    if row:
        return row
    now = _utcnow()
    row = MentorPresenceWeek(
        id=new_uuid(),
        mentor_id=mentor_id,
        week_start=week_start,
        seconds_online=0,
        warning_sent_at=None,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    return row


def accrue_mentor_presence(db: Session, mentor: Mentor, *, now: datetime | None = None) -> int:
    """
    Credit capped seconds since last accrual into the current Amsterdam week bucket.
    Also updates last_seen_at and presence_accrued_at.
    Returns seconds credited this call (0 on first ping).
    """
    stamp = now or _utcnow()
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)

    credit = 0
    prev = mentor.presence_accrued_at
    if prev is not None:
        if prev.tzinfo is None:
            prev = prev.replace(tzinfo=timezone.utc)
        delta = (stamp - prev).total_seconds()
        if delta > 0:
            credit = int(min(delta, max_credit_seconds()))

    mentor.last_seen_at = stamp
    mentor.presence_accrued_at = stamp
    mentor.updated_at = stamp

    if credit > 0:
        week = week_start_for(stamp)
        row = get_or_create_week_row(db, mentor_id=mentor.id, week_start=week)
        row.seconds_online = int(row.seconds_online or 0) + credit
        row.updated_at = stamp
        db.flush()

    return credit


def list_presence_for_week(
    db: Session,
    *,
    week_start: date,
    q: str | None = None,
    mentor_id: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[tuple[Mentor, MentorPresenceWeek | None]], int]:
    """Return (mentor, week_row|None) for approved/active coaches, optionally filtered by id/name/email."""
    if mentor_id and mentor_id.strip():
        query = db.query(Mentor).filter(Mentor.id == mentor_id.strip())
    else:
        query = db.query(Mentor).filter(Mentor.is_approved.is_(True), Mentor.status == "active")
        if q and q.strip():
            term = f"%{q.strip()}%"
            query = query.filter((Mentor.email.like(term)) | (Mentor.full_name.like(term)))
    total = query.count()
    mentors = query.order_by(Mentor.full_name.asc()).offset(skip).limit(limit).all()
    mentor_ids = [m.id for m in mentors]
    rows_by_id: dict[str, MentorPresenceWeek] = {}
    if mentor_ids:
        week_rows = (
            db.query(MentorPresenceWeek)
            .filter(
                MentorPresenceWeek.mentor_id.in_(mentor_ids),
                MentorPresenceWeek.week_start == week_start,
            )
            .all()
        )
        rows_by_id = {r.mentor_id: r for r in week_rows}
    return [(m, rows_by_id.get(m.id)) for m in mentors], total


def mentor_presence_history(
    db: Session,
    *,
    mentor_id: str,
    weeks: int = 8,
) -> list[MentorPresenceWeek]:
    limit = max(1, min(int(weeks), 52))
    current = week_start_for()
    starts = [current - timedelta(days=7 * i) for i in range(limit)]
    existing = (
        db.query(MentorPresenceWeek)
        .filter(
            MentorPresenceWeek.mentor_id == mentor_id,
            MentorPresenceWeek.week_start.in_(starts),
        )
        .all()
    )
    by_start = {r.week_start: r for r in existing}
    # Return newest-first, synthesize zero rows for missing weeks (not persisted).
    out: list[MentorPresenceWeek] = []
    now = _utcnow()
    for ws in starts:
        row = by_start.get(ws)
        if row:
            out.append(row)
        else:
            out.append(
                MentorPresenceWeek(
                    id="",
                    mentor_id=mentor_id,
                    week_start=ws,
                    seconds_online=0,
                    warning_sent_at=None,
                    created_at=now,
                    updated_at=now,
                )
            )
    return out


def month_start_for(dt: datetime | None = None) -> date:
    now = dt or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    local = now.astimezone(presence_tz()).date()
    return local.replace(day=1)


def _add_months(d: date, months: int) -> date:
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    return date(y, m, 1)


def sum_presence_seconds_for_range(
    db: Session,
    *,
    mentor_id: str,
    week_start_from: date,
    week_start_before: date,
) -> int:
    """Sum seconds for week rows with week_start in [from, before)."""
    rows = (
        db.query(MentorPresenceWeek.seconds_online)
        .filter(
            MentorPresenceWeek.mentor_id == mentor_id,
            MentorPresenceWeek.week_start >= week_start_from,
            MentorPresenceWeek.week_start < week_start_before,
        )
        .all()
    )
    return int(sum(int(r[0] or 0) for r in rows))


def mentor_presence_month_totals(
    db: Session,
    *,
    mentor_id: str,
    months: int = 6,
) -> list[tuple[date, int]]:
    """Newest-first list of (month_start, seconds) for calendar months in presence TZ."""
    limit = max(1, min(int(months), 24))
    current = month_start_for()
    out: list[tuple[date, int]] = []
    for i in range(limit):
        start = _add_months(current, -i)
        end = _add_months(start, 1)
        seconds = sum_presence_seconds_for_range(
            db,
            mentor_id=mentor_id,
            week_start_from=start,
            week_start_before=end,
        )
        out.append((start, seconds))
    return out


def mentor_presence_self_stats(
    db: Session,
    *,
    mentor_id: str,
    weeks: int = 12,
    months: int = 6,
) -> dict:
    """Stats payload for the coach's own platform-time dashboard."""
    min_hours = float(settings.mentor_weekly_min_hours or 20)
    threshold = min_weekly_seconds()
    this_week_start = week_start_for()
    this_month_start = month_start_for()
    next_month = _add_months(this_month_start, 1)

    week_row = (
        db.query(MentorPresenceWeek)
        .filter(
            MentorPresenceWeek.mentor_id == mentor_id,
            MentorPresenceWeek.week_start == this_week_start,
        )
        .first()
    )
    week_seconds = int(week_row.seconds_online or 0) if week_row else 0
    month_seconds = sum_presence_seconds_for_range(
        db,
        mentor_id=mentor_id,
        week_start_from=this_month_start,
        week_start_before=next_month,
    )
    history = mentor_presence_history(db, mentor_id=mentor_id, weeks=weeks)
    month_totals = mentor_presence_month_totals(db, mentor_id=mentor_id, months=months)
    return {
        "min_hours": min_hours,
        "timezone": settings.mentor_presence_timezone or "Europe/Amsterdam",
        "this_week": {
            "week_start": this_week_start,
            "seconds_online": week_seconds,
            "hours_online": hours_from_seconds(week_seconds),
            "meets_minimum": week_seconds >= threshold,
            "warning_sent_at": week_row.warning_sent_at if week_row else None,
        },
        "this_month": {
            "month_start": this_month_start,
            "seconds_online": month_seconds,
            "hours_online": hours_from_seconds(month_seconds),
        },
        "weeks": [
            {
                "week_start": r.week_start,
                "seconds_online": int(r.seconds_online or 0),
                "hours_online": hours_from_seconds(int(r.seconds_online or 0)),
                "meets_minimum": int(r.seconds_online or 0) >= threshold,
                "warning_sent_at": r.warning_sent_at,
            }
            for r in history
        ],
        "months": [
            {
                "month_start": ms,
                "seconds_online": secs,
                "hours_online": hours_from_seconds(secs),
            }
            for ms, secs in month_totals
        ],
    }


def send_weekly_presence_warnings(db: Session) -> int:
    """
    For the most recently completed week, email active coaches under the minimum hours.
    Idempotent via warning_sent_at. Returns number of warnings sent.
    """
    current = week_start_for()
    target_week = current - timedelta(days=7)
    threshold = min_weekly_seconds()
    min_hours = float(settings.mentor_weekly_min_hours or 20)
    sent = 0

    mentors = (
        db.query(Mentor)
        .filter(Mentor.is_approved.is_(True), Mentor.status == "active", Mentor.email_verified.is_(True))
        .all()
    )
    for mentor in mentors:
        row = get_or_create_week_row(db, mentor_id=mentor.id, week_start=target_week)
        if row.warning_sent_at is not None:
            continue
        seconds = int(row.seconds_online or 0)
        if seconds >= threshold:
            # Mark so we don't re-check forever with no mail needed.
            row.warning_sent_at = _utcnow()
            row.updated_at = _utcnow()
            continue

        hours = hours_from_seconds(seconds)
        week_end = target_week + timedelta(days=6)
        subject = "Reminder: weekly platform time below 20 hours"
        body = "\n".join(
            [
                f"Hello {mentor.full_name},",
                "",
                "Coaches are expected to spend at least "
                f"{min_hours:g} hours per week on the Mijn Levenspad platform.",
                "",
                f"Week: {target_week.isoformat()} – {week_end.isoformat()} (Europe/Amsterdam)",
                f"Time recorded: {hours:.2f} hours ({seconds} seconds)",
                f"Required minimum: {min_hours:g} hours",
                "",
                "Please make sure you are available on the platform regularly so clients can reach you.",
                "",
                "— Mijn Levenspad",
            ]
        )
        try:
            send_plain_email(to_email=mentor.email, subject=subject, body=body)
            row.warning_sent_at = _utcnow()
            row.updated_at = _utcnow()
            sent += 1
        except Exception:
            logger.exception(
                "Failed weekly presence warning mentor_id=%s week=%s",
                mentor.id,
                target_week.isoformat(),
            )

    db.commit()
    return sent
