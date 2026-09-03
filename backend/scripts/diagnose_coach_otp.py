"""Diagnose coach OTP / SMTP for recent mentor registrations."""
import sys
from datetime import datetime, timedelta, timezone

from db.session import SessionLocal
from models.email_otp import EmailOtpCode
from models.mentor import Mentor
from services.email_service import smtp_is_configured
from core.config import settings


def main() -> None:
    email_filter = (sys.argv[1] if len(sys.argv) > 1 else "").strip().lower()
    db = SessionLocal()
    try:
        print("SMTP_CONFIGURED", smtp_is_configured())
        print("SMTP_HOST", (settings.smtp_host or "").strip() or "(empty)")
        print("SMTP_FROM", (settings.smtp_from_email or "").strip() or "(empty)")
        print("SMTP_PORT", settings.smtp_port)
        print("SMTP_USE_TLS", settings.smtp_use_tls)
        print("ENVIRONMENT", settings.environment)

        since = datetime.now(timezone.utc) - timedelta(hours=6)
        q = db.query(Mentor).filter(Mentor.created_at >= since).order_by(Mentor.created_at.desc())
        if email_filter:
            q = db.query(Mentor).filter(Mentor.email == email_filter)
        mentors = q.all()
        print(f"MENTORS_LAST_6H={len(mentors) if not email_filter else len(mentors)}")
        for m in mentors:
            print(
                f"  mentor id={m.id} email={m.email} verified={m.email_verified} "
                f"status={m.status} created={m.created_at.isoformat() if m.created_at else None}"
            )

        otp_q = db.query(EmailOtpCode).filter(EmailOtpCode.role == "mentor")
        if email_filter:
            otp_q = otp_q.filter(EmailOtpCode.email == email_filter)
        else:
            otp_q = otp_q.filter(EmailOtpCode.created_at >= since)
        otps = otp_q.order_by(EmailOtpCode.created_at.desc()).limit(20).all()
        print(f"MENTOR_OTPS={len(otps)}")
        for o in otps:
            print(
                f"  otp email={o.email} subject={o.subject_id} attempts={o.attempts} "
                f"expires={o.expires_at.isoformat() if o.expires_at else None} "
                f"created={o.created_at.isoformat() if o.created_at else None}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
