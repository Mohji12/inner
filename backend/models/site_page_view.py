from datetime import datetime

from sqlalchemy import CHAR, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class SitePageView(Base):
    """Anonymous public-site page views for admin traffic analytics."""

    __tablename__ = "site_page_views"
    __table_args__ = (
        Index("idx_site_page_views_created", "created_at"),
        Index("idx_site_page_views_session", "session_key"),
        Index("idx_site_page_views_path", "path"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    session_key: Mapped[str] = mapped_column(CHAR(36), nullable=False)
    referrer_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visitor_kind: Mapped[str | None] = mapped_column(String(16), nullable=True)
