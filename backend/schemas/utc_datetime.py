"""UTC datetime JSON helpers for API responses."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer


def serialize_utc_datetime(dt: datetime) -> str:
    """Emit ISO-8601 with explicit UTC (`Z`) so browsers don't treat values as local."""
    if dt.tzinfo is None:
        return f"{dt.isoformat()}Z"
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


UtcDateTime = Annotated[
    datetime,
    PlainSerializer(serialize_utc_datetime, return_type=str, when_used="json"),
]
