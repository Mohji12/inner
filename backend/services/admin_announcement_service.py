"""Admin broadcast messages to coaches (in-app notification + email)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from core.security import new_uuid
from models.admin_announcement import AdminAnnouncement
from models.mentor import Mentor
from services.email_service import send_plain_emails
from services.notification_service import create_notification

logger = logging.getLogger(__name__)

ANNOUNCEMENT_TYPE = "admin_announcement"
DASHBOARD_LINK = "/mentor/dashboard"


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


def broadcast_admin_announcement(
    db: Session,
    *,
    admin_id: str | None,
    title: str,
    body: str,
    send_email: bool = True,
    mentor_id: str | None = None,
) -> tuple[AdminAnnouncement, str | None]:
    title_clean = title.strip()
    body_clean = body.strip()
    if not title_clean or not body_clean:
        raise ValueError("Title and message body are required")

    if mentor_id:
        coach = db.query(Mentor).filter(Mentor.id == mentor_id.strip()).first()
        if not coach:
            raise ValueError("Coach not found")
        coaches = [coach]
    else:
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
        recipient_count=len(coaches),
        emails_sent=0,
        created_at=now,
    )
    db.add(announcement)
    db.flush()

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

    # Persist in-app notifications before SMTP so a mail timeout cannot roll them back.
    db.commit()
    db.refresh(announcement)

    email_warning: str | None = None
    emails_sent = 0
    if send_email and coaches:
        emails_sent, email_warning = send_plain_emails(
            _coach_email_parts(coaches=coaches, title=title_clean, body=body_clean)
        )
        announcement.emails_sent = emails_sent
        db.commit()
        db.refresh(announcement)
    elif send_email and not coaches:
        email_warning = "No coaches matched this send, so no emails were delivered."

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
