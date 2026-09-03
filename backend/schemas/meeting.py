from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MeetingOut(BaseModel):
    """Meeting metadata for a live session (WebRTC via LiveKit)."""

    model_config = ConfigDict(from_attributes=True)

    chat_session_id: str
    room_name: str
    communication_mode: str | None = None
    status: str
    ends_at: datetime
    remaining_seconds: int
    can_join: bool
    timer_started: bool = False
    waiting_for: str | None = None
    allocated_duration_minutes: int | None = None


class MeetingTokenOut(BaseModel):
    provider: str = "livekit"
    url: str
    token: str
    room_name: str
    expires_in_seconds: int
