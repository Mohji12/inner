from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


class SlotCreate(BaseModel):
    slot_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    start_local: datetime | None = None
    end_local: datetime | None = None
    timezone: str | None = None
    slot_duration: int
    is_recurring: bool = False


class SlotUpdate(BaseModel):
    slot_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    start_local: datetime | None = None
    end_local: datetime | None = None
    timezone: str | None = None
    slot_duration: int | None = None
    is_recurring: bool | None = None


class SlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mentor_id: str
    slot_date: date
    start_time: time
    end_time: time
    start_at_utc: datetime
    end_at_utc: datetime
    slot_duration: int
    is_booked: bool
    is_recurring: bool
    created_at: datetime
