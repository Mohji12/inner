"""Generate password-reset OTP and email a coach a direct reset link + code.

Usage (on EC2):
  python3 send_coach_password_reset_link.py EMAIL MENTOR_ID "Coach Name"
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

sys.path.insert(0, "/home/ubuntu/inner/backend")

from core.config import settings
from core.security import new_uuid
from db.session import SessionLocal
from models.email_otp import EmailOtpCode
from services.email_service import send_plain_email
from services.otp_service import (
    delete_otp_for_email,
    generate_otp_code,
    hash_otp_code,
    password_reset_otp_role,
)

FRONTEND_BASE = "https://mijnlevenspad.com"


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit("Usage: send_coach_password_reset_link.py EMAIL MENTOR_ID COACH_NAME")

    coach_email = sys.argv[1].strip()
    coach_id = sys.argv[2].strip()
    coach_name = sys.argv[3].strip()
    email_l = coach_email.lower()
    otp_role = password_reset_otp_role("mentor")
    reset_url = f"{FRONTEND_BASE}/reset-password?email={quote(email_l)}&role=mentor"

    code = generate_otp_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes)

    with SessionLocal() as db:
        delete_otp_for_email(db, email_l, otp_role)
        db.add(
            EmailOtpCode(
                id=new_uuid(),
                email=email_l,
                role=otp_role,
                subject_id=coach_id,
                otp_hash=hash_otp_code(email_l, otp_role, code),
                expires_at=expires,
                attempts=0,
                created_at=datetime.now(timezone.utc),
            )
        )
        db.commit()

    subject = "Mijn Levenspad — reset your coach password"
    body = (
        f"Hello {coach_name},\n\n"
        "Use the link below to reset your coach password on Mijn Levenspad:\n\n"
        f"{reset_url}\n\n"
        f"Your reset code: {code}\n"
        f"(Valid for {settings.otp_expire_minutes} minutes.)\n\n"
        "On that page, enter the code and choose a new password.\n\n"
        "If you did not request this, you can ignore this email.\n\n"
        "— Mijn Levenspad"
    )

    if not send_plain_email(to_email=email_l, subject=subject, body=body):
        raise SystemExit("SMTP did not accept the email.")

    print("OK")
    print("email:", email_l)
    print("reset_url:", reset_url)
    print("code:", code)
    print("expires_minutes:", settings.otp_expire_minutes)


if __name__ == "__main__":
    main()
