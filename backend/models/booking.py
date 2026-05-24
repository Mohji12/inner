from datetime import date, datetime, time

from sqlalchemy import JSON, CHAR, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mentor_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True)
    slot_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("availability_slots.id", ondelete="CASCADE"), unique=True)
    booking_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    start_at_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration: Mapped[int] = mapped_column(Integer)
    session_topic: Mapped[str | None] = mapped_column(String(512), nullable=True)
    session_topic_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    problem_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    problem_description_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    goals_expected: Mapped[str | None] = mapped_column(Text, nullable=True)
    goals_expected_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    experience_level: Mapped[str | None] = mapped_column(String(64), nullable=True)
    communication_mode: Mapped[str | None] = mapped_column(String(64), nullable=True)
    urgency_level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    preferred_language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    attachments: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending_payment")
    payment_status: Mapped[str] = mapped_column(String(32), default="unpaid")
    payment_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meeting_link: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes_by_user: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_by_user_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes_by_mentor: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_by_mentor_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reschedule_count: Mapped[int] = mapped_column(Integer, default=0)
    reminder_24h_sent: Mapped[bool] = mapped_column(default=False)
    reminder_1h_sent: Mapped[bool] = mapped_column(default=False)
    reminder_15m_sent: Mapped[bool] = mapped_column(default=False)
    no_show_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="bookings")
    mentor = relationship("Mentor", back_populates="bookings")
    slot = relationship("AvailabilitySlot", back_populates="booking")
    payment = relationship("Payment", back_populates="booking", uselist=False)
    review = relationship("Review", back_populates="booking", uselist=False)
