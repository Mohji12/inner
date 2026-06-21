"""One-off helper to register and activate a coach account (dev/admin use)."""
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from core.coach_agreement import COACH_AGREEMENT_TEXT, COACH_AGREEMENT_VERSION
from core.security import hash_password, new_uuid
from db.session import SessionLocal
from models.mentor import Mentor
from services.i18n_service import to_i18n_map
from services.onboarding_payment_service import ensure_free_onboarding_completed, onboarding_fee_is_free

EMAIL = "mohangola89@gmail.com"
FULL_NAME = "Mohan Gola"
PHONE = "+31600008989"
PASSWORD = "Coach@2026!"
HEADLINE = "Spiritual coach"
BIO = "Supporting clients on their personal growth journey."


def main() -> None:
    db = SessionLocal()
    try:
        email = EMAIL.lower()
        existing = db.query(Mentor).filter(Mentor.email == email).first()
        if existing:
            mentor = existing
            print(f"Coach already exists: {mentor.id}")
        else:
            now = datetime.now(timezone.utc)
            mentor = Mentor(
                id=new_uuid(),
                full_name=FULL_NAME,
                email=email,
                phone_number=PHONE,
                country_code=None,
                timezone="UTC",
                password_hash=hash_password(PASSWORD),
                profile_image=None,
                headline=HEADLINE,
                headline_i18n=to_i18n_map(HEADLINE),
                bio=BIO,
                bio_i18n=to_i18n_map(BIO),
                languages_spoken=None,
                years_of_experience=3,
                current_company=None,
                previous_companies=None,
                education=None,
                certifications=None,
                expertise_areas=None,
                skills=None,
                tools_technologies=None,
                session_modes=None,
                average_rating=Decimal("0"),
                total_reviews=0,
                total_sessions_completed=0,
                chat_price_per_minute=Decimal("0.90"),
                chat_currency="EUR",
                chat_min_purchase_minutes=1,
                is_verified=False,
                is_approved=False,
                status="pending",
                email_verified=False,
                agreement_accepted_at=now,
                agreement_version=COACH_AGREEMENT_VERSION,
                agreement_text_snapshot=COACH_AGREEMENT_TEXT,
                agreement_text_snapshot_i18n=to_i18n_map(COACH_AGREEMENT_TEXT),
                created_at=now,
                updated_at=now,
            )
            db.add(mentor)
            db.flush()
            print(f"Created coach: {mentor.id}")

        mentor.email_verified = True
        mentor.updated_at = datetime.now(timezone.utc)

        if onboarding_fee_is_free():
            ensure_free_onboarding_completed(db, mentor=mentor)
        else:
            mentor.is_approved = True
            mentor.status = "active"
            mentor.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(mentor)
        print("Email verified:", mentor.email_verified)
        print("Approved:", mentor.is_approved)
        print("Status:", mentor.status)
        print("Onboarding free:", onboarding_fee_is_free())
        print("Login email:", email)
        print("Temporary password:", PASSWORD)
        print("Coach login: https://mijnlevenspad.com/login?role=mentor")
    finally:
        db.close()


if __name__ == "__main__":
    main()
