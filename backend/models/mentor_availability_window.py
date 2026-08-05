from datetime import datetime

from sqlalchemy import CHAR, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class MentorAvailabilityWindow(Base):
    """Informational window when a coach plans to be on the platform (not a bookable slot)."""

    __tablename__ = "mentor_availability_windows"
    __table_args__ = (
        Index("idx_mentor_availability_windows_mentor_start", "mentor_id", "start_at_utc"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True
    )
    start_at_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    mentor = relationship("Mentor", back_populates="availability_windows")
