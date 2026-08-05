from datetime import datetime

from sqlalchemy import CHAR, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class SupportInquiry(Base):
    """Persisted contact / support query form submissions."""

    __tablename__ = "support_inquiries"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    source: Mapped[str] = mapped_column(String(32), index=True)  # contact_page | user_dashboard | coach_dashboard
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    account_id: Mapped[str | None] = mapped_column(CHAR(36), nullable=True, index=True)
    subject: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
