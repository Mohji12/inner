from fastapi import APIRouter, HTTPException, status
from api.deps import DbSession, ChatActorDep, RequestLang
from schemas.notification import NotificationList, NotificationOut
from services.notification_service import get_notifications, mark_notification_as_read, mark_all_as_read, delete_notification
from schemas.auth import MessageResponse
from services.i18n_service import resolve_i18n_text

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("", response_model=NotificationList)
def list_notifications(db: DbSession, actor: ChatActorDep, lang: RequestLang, limit: int = 20, offset: int = 0):
    subject_id = actor.user.id if actor.user else actor.mentor.id
    role = "user" if actor.user else "mentor"
    
    notifications, unread_count = get_notifications(
        db, subject_id=subject_id, role=role, limit=limit, offset=offset
    )
    localized = []
    for n in notifications:
        data = NotificationOut.model_validate(n).model_dump()
        data["title"] = resolve_i18n_text(getattr(n, "title_i18n", None), n.title, lang)
        data["body"] = resolve_i18n_text(getattr(n, "body_i18n", None), n.body, lang)
        localized.append(NotificationOut.model_validate(data))
    return NotificationList(notifications=localized, unread_count=unread_count)

@router.post("/{notification_id}/read", response_model=MessageResponse)
def read_notification(db: DbSession, actor: ChatActorDep, notification_id: str):
    subject_id = actor.user.id if actor.user else actor.mentor.id
    role = "user" if actor.user else "mentor"
    
    success = mark_notification_as_read(db, notification_id=notification_id, subject_id=subject_id, role=role)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return MessageResponse(message="Notification marked as read")

@router.post("/read-all", response_model=MessageResponse)
def read_all_notifications(db: DbSession, actor: ChatActorDep):
    subject_id = actor.user.id if actor.user else actor.mentor.id
    role = "user" if actor.user else "mentor"
    
    mark_all_as_read(db, subject_id=subject_id, role=role)
    return MessageResponse(message="All notifications marked as read")

@router.delete("/{notification_id}", response_model=MessageResponse)
def remove_notification(db: DbSession, actor: ChatActorDep, notification_id: str):
    subject_id = actor.user.id if actor.user else actor.mentor.id
    role = "user" if actor.user else "mentor"
    
    success = delete_notification(db, notification_id=notification_id, subject_id=subject_id, role=role)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return MessageResponse(message="Notification deleted")
