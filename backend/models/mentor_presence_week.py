from datetime import date, datetime

from sqlalchemy import CHAR, Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class MentorPresenceWeek(Base):
    """Accumulated coach time-on-platform for one calendar week (Monday start)."""

    __tablename__ = "mentor_presence_weeks"
    __table_args__ = (
        UniqueConstraint("mentor_id", "week_start", name="uq_mentor_presence_week"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True
    )
    week_start: Mapped[date] = mapped_column(Date, index=True)
    seconds_online: Mapped[int] = mapped_column(Integer, default=0)
    warning_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    mentor = relationship("Mentor", back_populates="presence_weeks")
