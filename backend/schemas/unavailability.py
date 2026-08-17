from datetime import date as Date
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


UnavailabilityKind = Literal["one_off", "weekly"]


class UnavailabilityCreate(BaseModel):
    kind: UnavailabilityKind
    all_day: bool = False
    # Alias Date so the field name `date` does not shadow datetime.date (Python 3.14 + Pydantic).
    date: Date | None = None
    weekday: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    timezone: str | None = None


class UnavailabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mentor_id: str
    kind: UnavailabilityKind
    all_day: bool
    start_at_utc: datetime | None = None
    end_at_utc: datetime | None = None
    weekday: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    timezone: str
    created_at: datetime


class UnavailabilityPublicBlock(BaseModel):
    """Current or next time-off, sized for directory cards."""

    kind: UnavailabilityKind
    all_day: bool
    weekday: int | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    start_time: time | None = None
    end_time: time | None = None
