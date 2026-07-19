"""Public coach directory ranking: online first, then past performance."""
from __future__ import annotations

import math
from datetime import datetime, timezone

from schemas.mentor import MentorPublicOut

# Bayesian prior: treat sparse ratings closer to a neutral 4.0
_RATING_PRIOR_MEAN = 4.0
_RATING_PRIOR_WEIGHT = 5.0


def _aware(dt: datetime | None) -> datetime:
    if dt is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def bayesian_rating(average: float, review_count: int) -> float:
    """Dampened rating in 0–5 range for coaches with few reviews."""
    n = max(0, int(review_count))
    avg = max(0.0, min(5.0, float(average or 0)))
    return ((_RATING_PRIOR_MEAN * _RATING_PRIOR_WEIGHT) + (avg * n)) / (_RATING_PRIOR_WEIGHT + n)


def activity_score(last_seen_at: datetime | None, *, now: datetime | None = None) -> float:
    """0–20 points from how recently the coach was on the platform."""
    stamp = now or datetime.now(timezone.utc)
    seen = _aware(last_seen_at)
    if seen == datetime.min.replace(tzinfo=timezone.utc):
        return 0.0
    hours = max(0.0, (stamp - seen).total_seconds() / 3600.0)
    if hours < 1:
        return 20.0
    if hours < 24:
        return 14.0
    if hours < 24 * 7:
        return 8.0
    if hours < 24 * 30:
        return 2.0
    return 0.0


def performance_score(
    *,
    average_rating: float,
    total_reviews: int,
    total_sessions_completed: int,
    last_seen_at: datetime | None,
    now: datetime | None = None,
) -> float:
    """
    0–100 composite:
      ~50 rating (Bayesian), ~30 sessions completed, ~20 recent activity.
    """
    rating_part = (bayesian_rating(average_rating, total_reviews) / 5.0) * 50.0
    sessions = max(0, int(total_sessions_completed or 0))
    sessions_part = min(math.log1p(sessions) / math.log1p(100), 1.0) * 30.0
    activity_part = activity_score(last_seen_at, now=now)
    return round(rating_part + sessions_part + activity_part, 4)


def availability_tier(row: MentorPublicOut) -> int:
    """Higher is better: available (2) > busy online (1) > offline (0)."""
    if row.chat_available:
        return 2
    if row.is_online:
        return 1
    return 0


def rank_public_mentors(rows: list[MentorPublicOut], *, now: datetime | None = None) -> list[MentorPublicOut]:
    """
    Sort coaches for booking discovery:
    1) Available / online first
    2) Higher past-performance score
    3) More recent last_seen / created_at
    """
    stamp = now or datetime.now(timezone.utc)

    def sort_key(row: MentorPublicOut) -> tuple:
        score = performance_score(
            average_rating=float(row.average_rating or 0),
            total_reviews=int(row.total_reviews or 0),
            total_sessions_completed=int(row.total_sessions_completed or 0),
            last_seen_at=row.last_seen_at,
            now=stamp,
        )
        return (
            availability_tier(row),
            score,
            _aware(row.last_seen_at),
            _aware(row.created_at),
        )

    return sorted(rows, key=sort_key, reverse=True)
