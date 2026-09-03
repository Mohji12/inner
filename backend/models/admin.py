from datetime import datetime

from sqlalchemy import CHAR, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
