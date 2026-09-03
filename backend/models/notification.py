from datetime import datetime
from sqlalchemy import JSON, Boolean, CHAR, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from db.session import Base

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    mentor_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(64))  # e.g., "booking_confirmed", "new_message"
    title: Mapped[str] = mapped_column(String(255))
    title_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    body: Mapped[str] = mapped_column(Text)
    body_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    link: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
