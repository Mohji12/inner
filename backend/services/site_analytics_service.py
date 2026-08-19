"""Record and query anonymous website page views."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlparse

from sqlalchemy import func
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from core.security import new_uuid
from models.site_page_view import SitePageView
from schemas.site_analytics import ReferrerRow, TopPageRow

DEDUP_SECONDS = 90
MAX_PATH = 255
DIRECT_REFERRER = "Direct / unknown"

_SKIP_EXACT = {"/user", "/mentor"}
_SKIP_PREFIXES = ("/admin", "/chat")
_KEEP_QUERY_KEYS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "ref",
    "source",
    "campaign",
    "from",
}


def normalize_path(raw: str) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None
    parsed = urlparse(value if "://" in value else f"https://local.invalid{value if value.startswith('/') else '/' + value}")
    path = parsed.path or "/"
    if not path.startswith("/"):
        path = f"/{path}"
    kept = []
    for key, val in parse_qsl(parsed.query, keep_blank_values=False):
        lk = key.lower()
        if lk in _KEEP_QUERY_KEYS and val.strip():
            kept.append((lk, val.strip()[:80]))
    if kept:
        path = f"{path}?{urlencode(kept)}"
    if len(path) > MAX_PATH:
        path = path[:MAX_PATH]
    return path


def should_skip_path(path: str) -> bool:
    check = path.split("?", 1)[0]
    if check in _SKIP_EXACT:
        return True
    if any(check.startswith(prefix) for prefix in _SKIP_PREFIXES):
        return True
    if check.startswith("/user/") and not check.startswith("/user/register"):
        return True
    if check.startswith("/mentor/") and not check.startswith("/mentor/register"):
        return True
    return False


def referrer_host(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        host = urlparse(raw).hostname
    except Exception:
        return None
    if not host:
        return None
    host = host.lower()[:255]
    if host in {"localhost", "127.0.0.1"}:
        return None
    return host


def visitor_kind(raw: str | None) -> str | None:
    kind = (raw or "").strip().lower()
    if kind in {"guest", "user", "mentor", "admin"}:
        return kind
    return None


def record_page_view(
    db: Session,
    *,
    path: str,
    session_key: str,
    referrer: str | None,
    visitor_kind_raw: str | None,
) -> bool:
    clean_path = normalize_path(path)
    if not clean_path or should_skip_path(clean_path):
        return False
    key = "".join(ch for ch in session_key if ch.isalnum() or ch in "-")[:36]
    if len(key) < 8:
        return False
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=DEDUP_SECONDS)
    recent = (
        db.query(SitePageView.id)
        .filter(
            SitePageView.session_key == key,
            SitePageView.path == clean_path,
            SitePageView.created_at >= cutoff,
        )
        .first()
    )
    if recent:
        return False
    row = SitePageView(
        id=new_uuid(),
        created_at=now,
        path=clean_path,
        session_key=key,
        referrer_host=referrer_host(referrer),
        visitor_kind=visitor_kind(visitor_kind_raw),
    )
    db.add(row)
    db.commit()
    return True


@dataclass
class VisitStats:
    page_views: int = 0
    unique_visitors: int = 0
    by_day: list = field(default_factory=list)
    top_pages: list[TopPageRow] = field(default_factory=list)
    landing_pages: list[TopPageRow] = field(default_factory=list)
    referrers: list[ReferrerRow] = field(default_factory=list)


def _to_page_rows(rows: list) -> list[TopPageRow]:
    return [
        TopPageRow(path=path, views=int(views_n), unique_visitors=int(uniq_n))
        for path, views_n, uniq_n in rows
        if path
    ]


def visit_stats(
    db: Session,
    start: datetime,
    end: datetime,
    *,
    top_limit: int = 40,
) -> VisitStats:
    try:
        views = int(
            db.query(func.count(SitePageView.id))
            .filter(SitePageView.created_at >= start, SitePageView.created_at <= end)
            .scalar()
            or 0
        )
        uniques = int(
            db.query(func.count(func.distinct(SitePageView.session_key)))
            .filter(SitePageView.created_at >= start, SitePageView.created_at <= end)
            .scalar()
            or 0
        )
        day = func.date(SitePageView.created_at)
        series_rows = (
            db.query(day, func.count(SitePageView.id))
            .filter(SitePageView.created_at >= start, SitePageView.created_at <= end)
            .group_by(day)
            .order_by(day)
            .all()
        )
        top_rows = (
            db.query(
                SitePageView.path,
                func.count(SitePageView.id),
                func.count(func.distinct(SitePageView.session_key)),
            )
            .filter(SitePageView.created_at >= start, SitePageView.created_at <= end)
            .group_by(SitePageView.path)
            .order_by(func.count(SitePageView.id).desc())
            .limit(top_limit)
            .all()
        )
        first_at = (
            db.query(
                SitePageView.session_key.label("session_key"),
                func.min(SitePageView.created_at).label("first_at"),
            )
            .filter(SitePageView.created_at >= start, SitePageView.created_at <= end)
            .group_by(SitePageView.session_key)
            .subquery()
        )
        landing_join = (
            (SitePageView.session_key == first_at.c.session_key)
            & (SitePageView.created_at == first_at.c.first_at)
        )
        landing_rows = (
            db.query(
                SitePageView.path,
                func.count(SitePageView.id),
                func.count(func.distinct(SitePageView.session_key)),
            )
            .join(first_at, landing_join)
            .filter(SitePageView.created_at >= start, SitePageView.created_at <= end)
            .group_by(SitePageView.path)
            .order_by(func.count(SitePageView.id).desc())
            .limit(top_limit)
            .all()
        )
        referrer_rows = (
            db.query(
                SitePageView.referrer_host,
                func.count(SitePageView.id),
                func.count(func.distinct(SitePageView.session_key)),
            )
            .join(first_at, landing_join)
            .filter(SitePageView.created_at >= start, SitePageView.created_at <= end)
            .group_by(SitePageView.referrer_host)
            .order_by(func.count(func.distinct(SitePageView.session_key)).desc())
            .limit(top_limit)
            .all()
        )
    except (OperationalError, ProgrammingError):
        db.rollback()
        return VisitStats()

    from schemas.admin import DateCountPoint

    series = []
    for d, c in series_rows:
        if d is None:
            continue
        ds = d.isoformat() if hasattr(d, "isoformat") else str(d)
        series.append(DateCountPoint(date=ds, count=int(c)))
    referrers = [
        ReferrerRow(
            host=(host.strip() if host else DIRECT_REFERRER),
            views=int(views_n),
            unique_visitors=int(uniq_n),
        )
        for host, views_n, uniq_n in referrer_rows
    ]
    return VisitStats(
        page_views=views,
        unique_visitors=uniques,
        by_day=series,
        top_pages=_to_page_rows(top_rows),
        landing_pages=_to_page_rows(landing_rows),
        referrers=referrers,
    )
