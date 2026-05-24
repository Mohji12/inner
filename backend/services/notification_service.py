from datetime import datetime, timezone
from typing import Optional, Literal

from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import Session

from core.security import new_uuid
from models.notification import Notification
from services.i18n_service import to_i18n_map

def create_notification(
    db: Session,
    *,
    type: str,
    title: str,
    body: str,
    link: Optional[str] = None,
    user_id: Optional[str] = None,
    mentor_id: Optional[str] = None
) -> Notification:
    notification = Notification(
        id=new_uuid(),
        user_id=user_id,
        mentor_id=mentor_id,
        type=type,
        title=title,
        title_i18n=to_i18n_map(title),
        body=body,
        body_i18n=to_i18n_map(body),
        link=link,
        is_read=False,
        created_at=datetime.now(timezone.utc)
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification

def get_notifications(
    db: Session,
    *,
    subject_id: str,
    role: Literal["user", "mentor"],
    limit: int = 20,
    offset: int = 0
):
    if role == "user":
        stmt = select(Notification).where(Notification.user_id == subject_id)
    else:
        stmt = select(Notification).where(Notification.mentor_id == subject_id)
    
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    notifications = db.execute(stmt).scalars().all()
    
    # Get unread count
    if role == "user":
        count_stmt = select(func.count()).select_from(Notification).where(
            Notification.user_id == subject_id,
            Notification.is_read == False
        )
    else:
        count_stmt = select(func.count()).select_from(Notification).where(
            Notification.mentor_id == subject_id,
            Notification.is_read == False
        )
    unread_count = db.execute(count_stmt).scalar() or 0
    
    return notifications, unread_count

def mark_notification_as_read(db: Session, notification_id: str, subject_id: str, role: str) -> bool:
    stmt = select(Notification).where(Notification.id == notification_id)
    if role == "user":
        stmt = stmt.where(Notification.user_id == subject_id)
    else:
        stmt = stmt.where(Notification.mentor_id == subject_id)
    
    notification = db.execute(stmt).scalar_one_or_none()
    if not notification:
        return False
    
    notification.is_read = True
    db.commit()
    return True

def mark_all_as_read(db: Session, subject_id: str, role: str):
    if role == "user":
        stmt = update(Notification).where(Notification.user_id == subject_id).values(is_read=True)
    else:
        stmt = update(Notification).where(Notification.mentor_id == subject_id).values(is_read=True)
    
    db.execute(stmt)
    db.commit()

def delete_notification(db: Session, notification_id: str, subject_id: str, role: str) -> bool:
    if role == "user":
        stmt = delete(Notification).where(Notification.id == notification_id, Notification.user_id == subject_id)
    else:
        stmt = delete(Notification).where(Notification.id == notification_id, Notification.mentor_id == subject_id)
    
    result = db.execute(stmt)
    db.commit()
    return result.rowcount > 0
