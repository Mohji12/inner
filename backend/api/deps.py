from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from core.security import verify_access_token
from db.session import get_db
from models.admin import Admin
from models.mentor import Mentor
from models.user import User


DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    authorization: str | None = Header(None),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload or payload.get("role") != "user":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or user.account_status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def get_current_mentor(
    db: DbSession,
    authorization: str | None = Header(None),
) -> Mentor:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload or payload.get("role") != "mentor":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    mentor = db.query(Mentor).filter(Mentor.id == payload["sub"]).first()
    if not mentor:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Mentor not found")
    return mentor


def get_current_admin(
    db: DbSession,
    authorization: str | None = Header(None),
) -> Admin:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    admin = db.query(Admin).filter(Admin.id == payload["sub"]).first()
    if not admin:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin not found")
    return admin


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentMentor = Annotated[Mentor, Depends(get_current_mentor)]
CurrentAdmin = Annotated[Admin, Depends(get_current_admin)]


def get_current_approved_mentor(mentor: CurrentMentor) -> Mentor:
    if not mentor.is_approved or mentor.status != "active":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Mentor account must be approved and active",
        )
    return mentor


ApprovedMentor = Annotated[Mentor, Depends(get_current_approved_mentor)]


@dataclass
class ChatActor:
    user: User | None
    mentor: Mentor | None


def get_chat_actor(
    db: DbSession,
    authorization: str | None = Header(None),
) -> ChatActor:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    role = payload.get("role")
    sub = payload.get("sub")
    if role == "user":
        user = db.query(User).filter(User.id == sub).first()
        if not user or user.account_status != "active":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
        return ChatActor(user=user, mentor=None)
    if role == "mentor":
        mentor = db.query(Mentor).filter(Mentor.id == sub).first()
        if not mentor:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Mentor not found")
        return ChatActor(user=None, mentor=mentor)
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")


ChatActorDep = Annotated[ChatActor, Depends(get_chat_actor)]


@dataclass
class AnyActor:
    role: str
    subject_id: str


def get_any_actor(
    db: DbSession,
    authorization: str | None = Header(None),
) -> AnyActor:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    role = str(payload.get("role") or "")
    subject_id = str(payload.get("sub") or "")
    if role == "user":
        user = db.query(User).filter(User.id == subject_id).first()
        if not user or user.account_status != "active":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
        return AnyActor(role="user", subject_id=user.id)
    if role == "mentor":
        mentor = db.query(Mentor).filter(Mentor.id == subject_id).first()
        if not mentor:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Mentor not found")
        return AnyActor(role="mentor", subject_id=mentor.id)
    if role == "admin":
        admin = db.query(Admin).filter(Admin.id == subject_id).first()
        if not admin:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin not found")
        return AnyActor(role="admin", subject_id=admin.id)
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")


AnyActorDep = Annotated[AnyActor, Depends(get_any_actor)]


def get_request_language(accept_language: str | None = Header(None)) -> str:
    from services.i18n_service import normalize_lang

    return normalize_lang(accept_language)


RequestLang = Annotated[str, Depends(get_request_language)]
