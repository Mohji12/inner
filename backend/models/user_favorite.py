from datetime import datetime
from sqlalchemy import CHAR, Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship

from db.session import Base

class UserFavorite(Base):
    __tablename__ = "user_favorites"

    id = Column(CHAR(36), primary_key=True)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mentor_id = Column(CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "mentor_id", name="uq_user_mentor_favorite"),
    )

    user = relationship("User", backref="favorites")
    mentor = relationship("Mentor", backref="favorited_by")
