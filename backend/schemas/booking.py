from datetime import date, datetime, time
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class BookingCreate(BaseModel):
    slot_id: str | None = None
    mentor_id: str | None = None
    duration_minutes: int | None = None
    session_topic: str | None = None
    session_topic_i18n: dict[str, str] | None = None
    problem_description: str | None = None
    problem_description_i18n: dict[str, str] | None = None
    goals_expected: str | None = None
    goals_expected_i18n: dict[str, str] | None = None
    experience_level: str | None = None
    communication_mode: str | None = None
    urgency_level: str | None = None
    preferred_language: str | None = None
    attachments: list[Any] | None = None

    @model_validator(mode="after")
    def validate_booking_target(self) -> "BookingCreate":
        if self.slot_id:
            return self
        if self.mentor_id and self.duration_minutes:
            return self
        raise ValueError("Provide slot_id or mentor_id with duration_minutes")


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    mentor_id: str
    slot_id: str
    booking_date: date
    start_time: time
    end_time: time
    start_at_utc: datetime
    end_at_utc: datetime
    duration: int
    session_topic: str | None
    problem_description: str | None
    goals_expected: str | None
    experience_level: str | None
    communication_mode: str | None
    urgency_level: str | None
    preferred_language: str | None
    attachments: list[Any] | None
    status: str
    payment_status: str
    payment_id: str | None
    meeting_link: str | None
    notes_by_user: str | None
    notes_by_mentor: str | None
    created_at: datetime


class BookingUpdate(BaseModel):
    status: str | None = None
    notes_by_user: str | None = None
    notes_by_user_i18n: dict[str, str] | None = None
    notes_by_mentor: str | None = None
    notes_by_mentor_i18n: dict[str, str] | None = None
