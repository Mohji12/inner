from datetime import date, datetime, time

from sqlalchemy import Boolean, CHAR, Date, DateTime, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True)
    slot_date: Mapped[date] = mapped_column("slot_date", Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    start_at_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    slot_duration: Mapped[int] = mapped_column(Integer)
    is_booked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    mentor = relationship("Mentor", back_populates="slots")
    booking = relationship("Booking", back_populates="slot", uselist=False)
