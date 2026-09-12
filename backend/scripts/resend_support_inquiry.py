"""Resend one support inquiry by email substring."""
from __future__ import annotations

import sys

from db.session import SessionLocal
from models.support_inquiry import SupportInquiry
from services.email_service import send_plain_email
from services.support_inquiry_service import (
    _SUBJECT_PREFIX,
    build_support_email_body,
    support_recipients,
)


def main(needle: str) -> None:
    db = SessionLocal()
    try:
        row = (
            db.query(SupportInquiry)
            .filter(SupportInquiry.email.ilike(f"%{needle}%"))
            .order_by(SupportInquiry.created_at.desc())
            .first()
        )
        if not row:
            print("No inquiry found")
            sys.exit(1)
        print("inquiry", row.id, row.created_at, row.email, row.subject)
        body = build_support_email_body(
            source=row.source,
            full_name=row.full_name,
            email=row.email,
            subject=row.subject,
            message=row.message,
            phone=row.phone,
            role=row.role,
            account_id=row.account_id,
        )
        prefix = _SUBJECT_PREFIX.get(row.source, "[Support]")
        subject = f"{prefix} {row.subject[:120]}"
        for to in support_recipients():
            ok = send_plain_email(
                to_email=to,
                subject=subject,
                body=body,
                reply_to=row.email,
                from_name="Mijn Levenspad Support",
            )
            print("sent", to, ok)
            if not ok:
                sys.exit(2)
    finally:
        db.close()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "eximease47")
