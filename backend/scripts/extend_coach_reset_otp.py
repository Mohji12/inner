import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/home/ubuntu/inner/backend")

from sqlalchemy import text
from db.session import SessionLocal

EMAIL = "info@hettyboerstal.nl"
ROLE = "password_reset:mentor"
# Valid until used — practical far-future expiry (10 years).
expires_at = datetime.now(timezone.utc) + timedelta(days=3650)

with SessionLocal() as db:
    row = db.execute(
        text(
            "SELECT id, created_at, expires_at FROM email_otp_codes "
            "WHERE email = :email AND role = :role ORDER BY created_at DESC LIMIT 1"
        ),
        {"email": EMAIL, "role": ROLE},
    ).fetchone()
    if not row:
        raise SystemExit(f"No password reset OTP found for {EMAIL}")

    db.execute(
        text("UPDATE email_otp_codes SET expires_at = :expires_at WHERE id = :id"),
        {"expires_at": expires_at, "id": row[0]},
    )
    db.commit()
    print("OK")
    print("email:", EMAIL)
    print("otp_id:", row[0])
    print("old_expires_at:", row[2])
    print("new_expires_at:", expires_at.isoformat())
    print("note: code remains valid until she completes reset (then row is deleted)")
