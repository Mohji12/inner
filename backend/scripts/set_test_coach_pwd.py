import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.mentor import Mentor
from core.security import hash_password, new_uuid
from datetime import datetime, timezone

db = SessionLocal()

TEST_EMAIL = "test.coach@example.com"
TEST_PASSWORD = "TestPassword123!"

# Check if coach exists
mentor = db.query(Mentor).filter(Mentor.email == TEST_EMAIL).first()

if not mentor:
    # Also check if antigravity_test_coach_99@example.com exists to reuse or rename
    mentor = db.query(Mentor).filter(Mentor.email == "antigravity_test_coach_99@example.com").first()
    if mentor:
        mentor.email = TEST_EMAIL

if not mentor:
    now = datetime.now(timezone.utc)
    mentor = Mentor(
        id=new_uuid(),
        full_name="Test Coach",
        email=TEST_EMAIL,
        phone_number="+31600000001",
        timezone="UTC",
        password_hash=hash_password(TEST_PASSWORD),
        headline="Certified Life Coach",
        bio="Experienced test coach account for testing and development.",
        years_of_experience=5,
        kvk_number="12345678",
        is_approved=True,
        status="active",
        email_verified=True,
        is_totp_enabled=False,
        failed_login_attempts=0,
        locked_until=None,
        created_at=now,
        updated_at=now,
    )
    db.add(mentor)
    print(f"Created new test coach {TEST_EMAIL}")
else:
    mentor.password_hash = hash_password(TEST_PASSWORD)
    mentor.is_approved = True
    mentor.status = "active"
    mentor.email_verified = True
    mentor.is_totp_enabled = False
    mentor.failed_login_attempts = 0
    mentor.locked_until = None
    print(f"Updated existing test coach {mentor.email}")

db.commit()
print("=" * 40)
print("TEST COACH CREDENTIALS:")
print(f"Role: Coach / Mentor")
print(f"Email: {TEST_EMAIL}")
print(f"Password: {TEST_PASSWORD}")
print("Status: Active & Approved")
print("=" * 40)
db.close()

