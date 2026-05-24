from datetime import datetime

from sqlalchemy import CHAR, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class EmailOtpCode(Base):
    __tablename__ = "email_otp_codes"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(16))  # "user" | "mentor"
    subject_id: Mapped[str] = mapped_column(CHAR(36))
    otp_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
