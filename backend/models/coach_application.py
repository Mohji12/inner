from datetime import datetime

from sqlalchemy import CHAR, DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class CoachApplication(Base):
    __tablename__ = "coach_applications"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone_number: Mapped[str] = mapped_column(String(64))
    headline: Mapped[str] = mapped_column(String(512))
    motivation: Mapped[str] = mapped_column(Text)
    years_of_experience: Mapped[int] = mapped_column(Integer, default=0)
    languages_spoken: Mapped[list | None] = mapped_column(JSON, nullable=True)
    website_or_social: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
