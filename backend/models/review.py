from datetime import datetime

from sqlalchemy import CHAR, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mentor_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True)
    booking_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("bookings.id", ondelete="CASCADE"), unique=True)
    rating: Mapped[int] = mapped_column(Integer)
    review_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_text_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="reviews")
    mentor = relationship("Mentor", back_populates="reviews")
    booking = relationship("Booking", back_populates="review")
