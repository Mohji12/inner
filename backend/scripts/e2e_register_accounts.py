"""Register + verify a coach and a user, then print login details.

Usage (from backend/):
  $env:PYTHONPATH = "."
  python scripts/e2e_register_accounts.py
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
load_dotenv(BACKEND / ".env")
sys.path.insert(0, str(BACKEND))

from core.coach_agreement import COACH_AGREEMENT_TEXT, COACH_AGREEMENT_VERSION
from database import SessionLocal
from models.mentor import Mentor
from models.user import User
from services.onboarding_payment_service import activate_coach_after_email_verification

API = os.getenv("E2E_API", "https://inner.krintix.in/api/v1").rstrip("/")
FRONTEND = os.getenv("E2E_FRONTEND", "http://localhost:8081").rstrip("/")
PASSWORD = "Test1234!"
TS = int(time.time())
MENTOR_EMAIL = f"e2e.coach.{TS}@example.com"
USER_EMAIL = f"e2e.user.{TS}@example.com"
MENTOR_PHONE = f"+3161{TS % 10_000_000:07d}"
USER_PHONE = f"+3162{TS % 10_000_000:07d}"
CREDENTIALS_FILE = ROOT / ".e2e-register-credentials.json"


def ok(name: str, r: requests.Response, expect: int | tuple[int, ...] = 200) -> dict:
    codes = (expect,) if isinstance(expect, int) else expect
    if r.status_code not in codes:
        raise SystemExit(f"FAIL {name}: HTTP {r.status_code} — {r.text[:600]}")
    print(f"  OK  {name} ({r.status_code})")
    return r.json() if r.text else {}


def main() -> int:
    print("=== E2E register coach + user ===")
    print(f"API={API}")
    print(f"FRONTEND={FRONTEND}")

    origin = API[: -len("/api/v1")] if API.endswith("/api/v1") else API.rsplit("/api", 1)[0]
    ok("api health", requests.get(f"{origin}/health", timeout=30))

    print("\n1) Register coach")
    coach = ok(
        "coach register",
        requests.post(
            f"{API}/auth/mentor/register",
            json={
                "full_name": f"E2E Test Coach {TS % 10000}",
                "email": MENTOR_EMAIL,
                "phone_number": MENTOR_PHONE,
                "password": PASSWORD,
                "headline": "E2E spiritual coach",
                "bio": "Automated end-to-end test mentor account.",
                "years_of_experience": 3,
                "expertise_areas": ["Life coaching"],
                "kvk_number": "12345678",
                "agreement_accepted": True,
                "agreement_version": COACH_AGREEMENT_VERSION,
                "agreement_text_snapshot": COACH_AGREEMENT_TEXT,
                "account_holder_name": "E2E Test Coach",
                "iban": "NL91ABNA0417164300",
                "bic": "ABNANL2A",
            },
            timeout=90,
        ),
        201,
    )
    mentor_id = coach["id"]
    print(f"       id={mentor_id}")
    print(f"       email={MENTOR_EMAIL}")
    if coach.get("dev_verification_code"):
        ok(
            "coach verify-email",
            requests.post(
                f"{API}/auth/mentor/verify-email",
                json={"email": MENTOR_EMAIL, "code": coach["dev_verification_code"]},
                timeout=30,
            ),
        )

    print("\n2) Register user")
    user = ok(
        "user register",
        requests.post(
            f"{API}/auth/user/register",
            json={
                "full_name": f"E2E Test User {TS % 10000}",
                "email": USER_EMAIL,
                "phone_number": USER_PHONE,
                "password": PASSWORD,
                "preferred_language": "en",
            },
            timeout=90,
        ),
        201,
    )
    user_id = user["id"]
    print(f"       id={user_id}")
    print(f"       email={USER_EMAIL}")
    if user.get("dev_verification_code"):
        ok(
            "user verify-email",
            requests.post(
                f"{API}/auth/user/verify-email",
                json={"email": USER_EMAIL, "code": user["dev_verification_code"]},
                timeout=30,
            ),
        )

    print("\n3) Verify email + admin-approve coach in DB")
    db = SessionLocal()
    try:
        mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
        db_user = db.query(User).filter(User.id == user_id).first()
        if not mentor or not db_user:
            raise SystemExit("accounts missing in DB")
        now = datetime.now(timezone.utc)
        mentor.email_verified = True
        mentor.updated_at = now
        activate_coach_after_email_verification(db, mentor=mentor)
        mentor.is_approved = True
        mentor.status = "active"
        mentor.updated_at = now
        db_user.email_verified = True
        db_user.updated_at = now
        db.commit()
        db.refresh(mentor)
        db.refresh(db_user)
        print(f"  OK  coach approved={mentor.is_approved} status={mentor.status}")
        print(f"  OK  user verified={db_user.email_verified} status={db_user.account_status}")
    finally:
        db.close()

    print("\n4) API login")
    coach_login = ok(
        "coach login",
        requests.post(
            f"{API}/auth/mentor/login",
            json={"email": MENTOR_EMAIL, "password": PASSWORD},
            timeout=30,
        ),
    )
    if not coach_login.get("access_token"):
        raise SystemExit(f"coach login missing token: {coach_login}")
    user_login = ok(
        "user login",
        requests.post(
            f"{API}/auth/user/login",
            json={"email": USER_EMAIL, "password": PASSWORD},
            timeout=30,
        ),
    )
    if not user_login.get("access_token"):
        raise SystemExit(f"user login missing token: {user_login}")

    out = {
        "password": PASSWORD,
        "coach": {
            "email": MENTOR_EMAIL,
            "password": PASSWORD,
            "id": mentor_id,
            "login_local": f"{FRONTEND}/login?role=mentor",
            "login_prod": "https://mijnlevenspad.com/login?role=mentor",
        },
        "user": {
            "email": USER_EMAIL,
            "password": PASSWORD,
            "id": user_id,
            "login_local": f"{FRONTEND}/login?role=user",
            "login_prod": "https://mijnlevenspad.com/login?role=user",
        },
    }
    CREDENTIALS_FILE.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("\n=== E2E PASSED ===")
    print(json.dumps(out, indent=2))
    print(f"wrote {CREDENTIALS_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
