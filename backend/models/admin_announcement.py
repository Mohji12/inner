from datetime import datetime

from sqlalchemy import CHAR, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class AdminAnnouncement(Base):
    """Message posted by an admin and broadcast to coaches."""

    __tablename__ = "admin_announcements"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    admin_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("admins.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    recipient_count: Mapped[int] = mapped_column(Integer, default=0)
    emails_sent: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
