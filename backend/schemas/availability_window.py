from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field


class AvailabilityWindowCreate(BaseModel):
    window_date: date
    start_time: time
    end_time: time
    timezone: str | None = None


class AvailabilityWindowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mentor_id: str
    start_at_utc: datetime
    end_at_utc: datetime
    timezone: str
    created_at: datetime


class AvailabilityWindowPublicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    start_at_utc: datetime
    end_at_utc: datetime
    timezone: str
