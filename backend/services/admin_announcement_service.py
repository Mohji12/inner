"""Admin broadcast messages to coaches (in-app notification + email)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from core.security import new_uuid
from models.admin_announcement import AdminAnnouncement
from models.mentor import Mentor
from services.email_service import send_plain_email
from services.notification_service import create_notification

logger = logging.getLogger(__name__)

ANNOUNCEMENT_TYPE = "admin_announcement"
DASHBOARD_LINK = "/mentor/dashboard"


def broadcast_admin_announcement(
    db: Session,
    *,
    admin_id: str | None,
    title: str,
    body: str,
    send_email: bool = True,
) -> AdminAnnouncement:
    title_clean = title.strip()
    body_clean = body.strip()
    if not title_clean or not body_clean:
        raise ValueError("Title and message body are required")

    coaches = (
        db.query(Mentor)
        .filter(
            Mentor.is_approved.is_(True),
            Mentor.status == "active",
            Mentor.email_verified.is_(True),
        )
        .all()
    )

    now = datetime.now(timezone.utc)
    announcement = AdminAnnouncement(
        id=new_uuid(),
        admin_id=admin_id,
        title=title_clean,
        body=body_clean,
        recipient_count=0,
        emails_sent=0,
        created_at=now,
    )
    db.add(announcement)
    db.flush()

    emails_sent = 0
    for coach in coaches:
        create_notification(
            db,
            type=ANNOUNCEMENT_TYPE,
            title=title_clean,
            body=body_clean,
            link=DASHBOARD_LINK,
            mentor_id=coach.id,
            commit=False,
        )
        if send_email:
            mail_body = "\n".join(
                [
                    f"Hello {coach.full_name},",
                    "",
                    "You have a new message from the Mijn Levenspad admin team:",
                    "",
                    title_clean,
                    "",
                    body_clean,
                    "",
                    "Please open your coach dashboard to view it:",
                    "https://mijnlevenspad.com/mentor/dashboard",
                    "",
                    "— Mijn Levenspad",
                ]
            )
            try:
                send_plain_email(
                    to_email=coach.email,
                    subject=f"Admin message: {title_clean}",
                    body=mail_body,
                )
                emails_sent += 1
            except Exception:
                logger.exception(
                    "Failed to email admin announcement to mentor_id=%s",
                    coach.id,
                )

    announcement.recipient_count = len(coaches)
    announcement.emails_sent = emails_sent
    db.commit()
    db.refresh(announcement)
    return announcement


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
