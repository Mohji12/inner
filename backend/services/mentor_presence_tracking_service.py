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
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[tuple[Mentor, MentorPresenceWeek | None]], int]:
    """Return (mentor, week_row|None) for approved/active coaches, optionally filtered by name/email."""
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
