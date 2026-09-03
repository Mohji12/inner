from datetime import datetime, time

from sqlalchemy import Boolean, CHAR, DateTime, ForeignKey, Index, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class MentorUnavailability(Base):
    """Coach-posted time off: a specific date range or a repeating weekday."""

    __tablename__ = "mentor_unavailability"
    __table_args__ = (Index("idx_mentor_unavailability_mentor", "mentor_id"),)

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    start_at_utc: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_at_utc: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    weekday: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    mentor = relationship("Mentor", back_populates="unavailability_rows")
