from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class NotificationBase(BaseModel):
    type: str
    title: str
    title_i18n: dict[str, str] | None = None
    body: str
    body_i18n: dict[str, str] | None = None
    link: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: Optional[str] = None
    mentor_id: Optional[str] = None

class NotificationOut(NotificationBase):
    id: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationList(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int
