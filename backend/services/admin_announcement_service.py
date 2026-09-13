"""Admin broadcast messages to coaches or users (in-app notification + email)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy.orm import Session

from core.security import new_uuid
from models.admin_announcement import AdminAnnouncement
from models.mentor import Mentor
from models.user import User
from services.email_service import send_plain_emails
from services.notification_service import create_notification
from services.deepl_service import ensure_i18n_map
from services.i18n_service import DEFAULT_LANG, normalize_lang

logger = logging.getLogger(__name__)

ANNOUNCEMENT_TYPE = "admin_announcement"
Audience = Literal["coach", "user"]

COACH_DASHBOARD_LINK = "/mentor/dashboard"
USER_DASHBOARD_LINK = "/user/dashboard"


def _coach_email_parts(*, coaches: list[Mentor], title: str, body: str) -> list[tuple[str, str, str]]:
    subject = f"Admin message: {title}"
    items: list[tuple[str, str, str]] = []
    for coach in coaches:
        mail_body = "\n".join(
            [
                f"Hello {coach.full_name},",
                "",
                "You have a new message from the Mijn Levenspad admin team:",
                "",
                title,
                "",
                body,
                "",
                "Please open your coach dashboard to view it:",
                "https://mijnlevenspad.com/mentor/dashboard",
                "",
                "— Mijn Levenspad",
            ]
        )
        items.append(((coach.email or "").strip(), subject, mail_body))
    return items


def _user_email_parts(*, users: list[User], title: str, body: str) -> list[tuple[str, str, str]]:
    subject = f"Admin message: {title}"
    items: list[tuple[str, str, str]] = []
    for user in users:
        mail_body = "\n".join(
            [
                f"Hello {user.full_name},",
                "",
                "You have a new message from the Mijn Levenspad admin team:",
                "",
                title,
                "",
                body,
                "",
                "Please open your dashboard to view it:",
                "https://mijnlevenspad.com/user/dashboard",
                "",
                "— Mijn Levenspad",
            ]
        )
        items.append(((user.email or "").strip(), subject, mail_body))
    return items


def _active_coaches(db: Session, *, mentor_id: str | None) -> list[Mentor]:
    if mentor_id:
        coach = db.query(Mentor).filter(Mentor.id == mentor_id.strip()).first()
        if not coach:
            raise ValueError("Coach not found")
        return [coach]
    return (
        db.query(Mentor)
        .filter(
            Mentor.is_approved.is_(True),
            Mentor.status == "active",
            Mentor.email_verified.is_(True),
        )
        .all()
    )


def _active_users(db: Session, *, user_id: str | None) -> list[User]:
    if user_id:
        user = db.query(User).filter(User.id == user_id.strip()).first()
        if not user:
            raise ValueError("User not found")
        return [user]
    return (
        db.query(User)
        .filter(
            User.account_status == "active",
            User.email_verified.is_(True),
        )
        .all()
    )


def broadcast_admin_announcement(
    db: Session,
    *,
    admin_id: str | None,
    title: str,
    body: str,
    send_email: bool = True,
    audience: Audience = "coach",
    mentor_id: str | None = None,
    user_id: str | None = None,
    source_lang: str = DEFAULT_LANG,
) -> tuple[AdminAnnouncement, str | None]:
    title_clean = title.strip()
    body_clean = body.strip()
    if not title_clean or not body_clean:
        raise ValueError("Title and message body are required")

    audience_clean: Audience = "user" if (audience or "coach").strip().lower() == "user" else "coach"
    mentor_id_clean = (mentor_id or "").strip() or None
    user_id_clean = (user_id or "").strip() or None
    lang = normalize_lang(source_lang)

    if audience_clean == "coach" and user_id_clean:
        raise ValueError("user_id is only valid when audience is user")
    if audience_clean == "user" and mentor_id_clean:
        raise ValueError("mentor_id is only valid when audience is coach")

    if audience_clean == "coach":
        recipients = _active_coaches(db, mentor_id=mentor_id_clean)
        link = COACH_DASHBOARD_LINK
        empty_email_warning = "No coaches matched this send, so no emails were delivered."
    else:
        recipients = _active_users(db, user_id=user_id_clean)
        link = USER_DASHBOARD_LINK
        empty_email_warning = "No users matched this send, so no emails were delivered."

    # In-app bell: full i18n via DeepL (falls back to source text when key missing).
    title_i18n = ensure_i18n_map(title_clean, lang)
    body_i18n = ensure_i18n_map(body_clean, lang)

    now = datetime.now(timezone.utc)
    announcement = AdminAnnouncement(
        id=new_uuid(),
        admin_id=admin_id,
        title=title_clean,
        body=body_clean,
        audience=audience_clean,
        recipient_count=len(recipients),
        emails_sent=0,
        created_at=now,
    )
    db.add(announcement)
    db.flush()

    for recipient in recipients:
        if audience_clean == "coach":
            create_notification(
                db,
                type=ANNOUNCEMENT_TYPE,
                title=title_clean,
                body=body_clean,
                link=link,
                mentor_id=recipient.id,
                title_i18n=title_i18n,
                body_i18n=body_i18n,
                commit=False,
            )
        else:
            create_notification(
                db,
                type=ANNOUNCEMENT_TYPE,
                title=title_clean,
                body=body_clean,
                link=link,
                user_id=recipient.id,
                title_i18n=title_i18n,
                body_i18n=body_i18n,
                commit=False,
            )

    # Persist in-app notifications before SMTP so a mail timeout cannot roll them back.
    db.commit()
    db.refresh(announcement)

    email_warning: str | None = None
    emails_sent = 0
    if send_email and recipients:
        if audience_clean == "coach":
            email_parts = _coach_email_parts(
                coaches=recipients,  # type: ignore[arg-type]
                title=title_clean,
                body=body_clean,
            )
        else:
            email_parts = _user_email_parts(
                users=recipients,  # type: ignore[arg-type]
                title=title_clean,
                body=body_clean,
            )
        emails_sent, email_warning = send_plain_emails(email_parts)
        announcement.emails_sent = emails_sent
        db.commit()
        db.refresh(announcement)
    elif send_email and not recipients:
        email_warning = empty_email_warning

    return announcement, email_warning


def list_admin_announcements(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[AdminAnnouncement], int]:
    total = db.query(AdminAnnouncement).count()
    rows = (
        db.query(AdminAnnouncement)
        .order_by(AdminAnnouncement.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return rows, total
