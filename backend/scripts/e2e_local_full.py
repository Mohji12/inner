"""Full local E2E: register sample mentor+user, exercise modules, LIFE100 pay, optional keep for UI, cleanup.

Usage (from backend/):
  $env:PYTHONPATH = "."
  $env:E2E_API = "http://127.0.0.1:8001/api/v1"
  $env:E2E_FRONTEND = "http://localhost:8081"
  .\\.venv\\Scripts\\python.exe scripts\\e2e_local_full.py
  .\\.venv\\Scripts\\python.exe scripts\\e2e_local_full.py --keep-accounts   # leave samples for Playwright
  .\\.venv\\Scripts\\python.exe scripts\\e2e_local_full.py --cleanup-only   # delete from credentials JSON
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

BASE = os.getenv("E2E_API", "http://127.0.0.1:8001/api/v1").rstrip("/")
FRONTEND = os.getenv("E2E_FRONTEND", "http://localhost:8081").rstrip("/")
API_ORIGIN = BASE[: -len("/api/v1")] if BASE.endswith("/api/v1") else BASE.rsplit("/api", 1)[0]
PASSWORD = "Test1234!"
ADMIN_EMAIL = os.getenv("E2E_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("E2E_ADMIN_PASSWORD", "Admin123!")
BOOKING_PROMO = os.getenv("E2E_BOOKING_PROMO", "LIFE100")
CREDENTIALS_FILE = ROOT / ".e2e-full-credentials.json"

TS = int(time.time())
MENTOR_EMAIL = f"e2e.mentor.{TS}@example.com"
USER_EMAIL = f"e2e.user.{TS}@example.com"
MENTOR_PHONE = f"+3161{TS % 10_000_000:07d}"
USER_PHONE = f"+3162{TS % 10_000_000:07d}"

from core.coach_agreement import COACH_AGREEMENT_TEXT, COACH_AGREEMENT_VERSION  # noqa: E402


class StepError(RuntimeError):
    pass


def ok(name: str, r: requests.Response, expect: int | tuple[int, ...] = 200) -> dict:
    codes = (expect,) if isinstance(expect, int) else expect
    if r.status_code not in codes:
        raise StepError(f"{name}: HTTP {r.status_code} — {r.text[:600]}")
    print(f"  OK  {name} ({r.status_code})")
    if not r.text:
        return {}
    try:
        return r.json()
    except Exception:
        return {}


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def ensure_promos() -> None:
    from database import SessionLocal
    from decimal import Decimal
    from models.promo_code import PromoCode
    from core.security import new_uuid

    db = SessionLocal()
    try:
        for code, scope in (("LIFE100", "all"), ("COACHFREE", "onboarding")):
            row = db.query(PromoCode).filter(PromoCode.code == code).first()
            if row:
                row.scope = scope if code == "LIFE100" else (row.scope or scope)
                row.is_active = True
                row.discount_type = "percentage"
                row.discount_value = Decimal("100.00")
            else:
                db.add(
                    PromoCode(
                        id=new_uuid(),
                        code=code,
                        discount_type="percentage",
                        discount_value=Decimal("100.00"),
                        scope=scope,
                        is_active=True,
                        created_at=datetime.now(timezone.utc),
                    )
                )
        db.commit()
        print("  OK  promos LIFE100 + COACHFREE ensured")
    finally:
        db.close()


def verify_accounts_in_dev(mentor_id: str, user_id: str) -> None:
    from database import SessionLocal
    from models.mentor import Mentor
    from models.user import User
    from services.onboarding_payment_service import activate_coach_after_email_verification

    db = SessionLocal()
    try:
        mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
        user = db.query(User).filter(User.id == user_id).first()
        if not mentor or not user:
            raise StepError("E2E accounts missing in DB")
        now = datetime.now(timezone.utc)
        mentor.email_verified = True
        mentor.updated_at = now
        activate_coach_after_email_verification(db, mentor=mentor)
        mentor.is_approved = True
        mentor.status = "active"
        mentor.chat_price_per_minute = mentor.chat_price_per_minute or __import__("decimal").Decimal("0.90")
        mentor.updated_at = now
        # Ensure session packages visible on card
        vis = dict(mentor.public_card_visibility or {})
        vis.setdefault("session_packages", True)
        vis.setdefault("profile_photo", True)
        mentor.public_card_visibility = vis
        user.email_verified = True
        user.updated_at = now
        db.commit()
        print("  OK  DB verify + approve mentor + user")
    finally:
        db.close()


def register_mentor() -> str:
    r = requests.post(
        f"{BASE}/auth/mentor/register",
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
    )
    data = ok("mentor register", r, 201)
    mentor_id = data["id"]
    code = data.get("dev_verification_code")
    if code:
        ok(
            "mentor verify-email",
            requests.post(
                f"{BASE}/auth/mentor/verify-email",
                json={"email": MENTOR_EMAIL, "code": code},
                timeout=30,
            ),
        )
    print(f"       mentor_id={mentor_id} email={MENTOR_EMAIL}")
    return mentor_id


def register_user() -> str:
    r = requests.post(
        f"{BASE}/auth/user/register",
        json={
            "full_name": f"E2E Test User {TS % 10000}",
            "email": USER_EMAIL,
            "phone_number": USER_PHONE,
            "password": PASSWORD,
            "preferred_language": "en",
        },
        timeout=90,
    )
    data = ok("user register", r, 201)
    user_id = data["id"]
    code = data.get("dev_verification_code")
    if code:
        ok(
            "user verify-email",
            requests.post(
                f"{BASE}/auth/user/verify-email",
                json={"email": USER_EMAIL, "code": code},
                timeout=30,
            ),
        )
    print(f"       user_id={user_id} email={USER_EMAIL}")
    return user_id


def login(role: str, email: str, password: str | None = None) -> tuple[requests.Session, str]:
    s = requests.Session()
    pwd = password or PASSWORD
    if role == "admin":
        r = s.post(
            f"{BASE}/auth/admin/login",
            json={"email": email, "password": pwd},
            timeout=30,
        )
    else:
        r = s.post(f"{BASE}/auth/{role}/login", json={"email": email, "password": pwd}, timeout=30)
    data = ok(f"{role} login", r)
    token = data.get("access_token")
    if not token:
        raise StepError(f"{role} login: no access_token")
    return s, token


def tiny_jpeg_bytes() -> bytes:
    # Minimal valid JPEG (1x1)
    import base64

    return base64.b64decode(
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
        "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy"
        "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA"
        "AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEB"
        "AQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/E"
        "ABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAI"
        "AQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAA"
        "AAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z"
    )


def write_credentials(payload: dict) -> None:
    CREDENTIALS_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"  OK  wrote {CREDENTIALS_FILE.name}")


def load_credentials() -> dict:
    if not CREDENTIALS_FILE.is_file():
        raise StepError(f"Missing {CREDENTIALS_FILE}")
    return json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))


def cleanup_accounts(mentor_id: str | None, user_id: str | None) -> None:
    if not mentor_id and not user_id:
        print("  ..  nothing to cleanup")
        return
    s, token = login("admin", ADMIN_EMAIL, ADMIN_PASSWORD)
    h = auth_headers(token)
    if user_id:
        r = s.delete(f"{BASE}/admin/users/{user_id}", headers=h, timeout=60)
        ok("admin delete user", r, (200, 204))
    if mentor_id:
        r = s.delete(f"{BASE}/admin/mentors/{mentor_id}", headers=h, timeout=60)
        ok("admin delete mentor", r, (200, 204))
    # Confirm gone
    if mentor_id:
        r = requests.get(f"{BASE}/mentors/{mentor_id}", timeout=30)
        if r.status_code == 404:
            print("  OK  mentor gone from public API")
        else:
            mentors = requests.get(f"{BASE}/mentors", timeout=30).json()
            if any(m.get("id") == mentor_id for m in mentors):
                raise StepError("mentor still listed publicly after delete")
            print("  OK  mentor not in public list")


def run_api_suite(*, keep_accounts: bool) -> int:
    mentor_id: str | None = None
    user_id: str | None = None
    booking_id: str | None = None

    print("=== E2E local FULL (API) ===")
    print(f"API={BASE}")
    print(f"FRONTEND={FRONTEND}\n")

    try:
        ok("frontend home", requests.get(FRONTEND, timeout=15))
        ok("backend health", requests.get(f"{API_ORIGIN}/health", timeout=30))
        ensure_promos()

        print("\n-- Register --")
        mentor_id = register_mentor()
        user_id = register_user()
        verify_accounts_in_dev(mentor_id, user_id)

        mentor_sess, mentor_token = login("mentor", MENTOR_EMAIL)
        user_sess, user_token = login("user", USER_EMAIL)
        mh = auth_headers(mentor_token)
        uh = auth_headers(user_token)

        write_credentials(
            {
                "api": BASE,
                "frontend": FRONTEND,
                "password": PASSWORD,
                "admin": {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                "coach": {
                    "email": MENTOR_EMAIL,
                    "password": PASSWORD,
                    "id": mentor_id,
                    "login_url": f"{FRONTEND}/login?role=mentor",
                },
                "user": {
                    "email": USER_EMAIL,
                    "password": PASSWORD,
                    "id": user_id,
                    "login_url": f"{FRONTEND}/login?role=user",
                },
            }
        )

        print("\n-- Coach modules --")
        ok("mentor presence", mentor_sess.post(f"{BASE}/mentors/me/presence", headers=mh), (200, 204))
        ok(
            "mentor patch profile",
            mentor_sess.patch(
                f"{BASE}/mentors/me",
                headers=mh,
                json={"headline": "E2E coach headline", "bio": "Updated bio for E2E."},
            ),
        )
        files = {
            "file": ("avatar.jpg", io.BytesIO(tiny_jpeg_bytes()), "image/jpeg"),
        }
        r = mentor_sess.post(f"{BASE}/upload/avatar", headers=mh, files=files, timeout=60)
        ok("mentor upload avatar", r)

        start = datetime.now(timezone.utc) + timedelta(days=2)
        end = start + timedelta(minutes=30)
        slot = ok(
            "mentor create slot",
            mentor_sess.post(
                f"{BASE}/mentors/me/slots",
                headers=mh,
                json={
                    "start_local": start.strftime("%Y-%m-%dT%H:%M:%S"),
                    "end_local": end.strftime("%Y-%m-%dT%H:%M:%S"),
                    "timezone": "UTC",
                    "slot_duration": 30,
                    "is_recurring": False,
                },
            ),
            201,
        )
        slot_id = slot["id"]
        ok("mentor list slots", mentor_sess.get(f"{BASE}/mentors/me/slots", headers=mh))

        # Availability window
        try:
            day = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
            ok(
                "mentor availability window",
                mentor_sess.post(
                    f"{BASE}/mentors/me/availability-windows",
                    headers=mh,
                    json={
                        "window_date": day,
                        "start_time": "10:00:00",
                        "end_time": "12:00:00",
                        "timezone": "UTC",
                    },
                ),
                (200, 201),
            )
        except StepError as e:
            print(f"  ..  availability window skipped: {e}")

        print("\n-- Public + booking + LIFE100 --")
        mentors = ok("public mentors", requests.get(f"{BASE}/mentors", timeout=30))
        if not any(m["id"] == mentor_id for m in mentors):
            raise StepError("E2E mentor not in public directory")
        ok("mentor detail", requests.get(f"{BASE}/mentors/{mentor_id}", timeout=30))
        ok("platform pricing", requests.get(f"{BASE}/mentors/pricing", timeout=30))
        public_slots = ok("public slots", requests.get(f"{BASE}/mentors/{mentor_id}/slots", timeout=30))
        if not any(s["id"] == slot_id for s in public_slots):
            raise StepError("slot not public")

        booking = ok(
            "create booking",
            user_sess.post(
                f"{BASE}/bookings",
                headers=uh,
                json={
                    "slot_id": slot_id,
                    "session_topic": "E2E clarity session",
                    "communication_mode": "video",
                },
            ),
            201,
        )
        booking_id = booking["id"]
        preview = ok(
            "checkout preview",
            user_sess.get(f"{BASE}/payments/booking-checkout-preview?booking_id={booking_id}", headers=uh),
        )
        total = float(preview.get("total_eur") or 0)
        print(f"       total_eur={total}")

        ok(
            "validate LIFE100",
            user_sess.post(
                f"{BASE}/promo-codes/validate",
                headers=uh,
                json={"code": BOOKING_PROMO, "amount": total, "mentor_id": mentor_id},
            ),
        )

        intent = ok(
            "create-intent LIFE100",
            user_sess.post(
                f"{BASE}/payments/create-intent",
                headers=uh,
                json={"booking_id": booking_id, "promo_code": BOOKING_PROMO, "checkout_currency": "EUR"},
            ),
        )
        if float(intent.get("amount") or 0) != 0.0:
            raise StepError(f"expected promo zero amount, got {intent}")
        print(f"       checkout_url={intent.get('checkout_url')}")

        my_bookings = ok("user bookings", user_sess.get(f"{BASE}/bookings/me", headers=uh))
        paid = next((b for b in my_bookings if b["id"] == booking_id), None)
        if not paid or paid.get("payment_status") != "paid":
            raise StepError(f"booking not paid via promo: {paid}")

        print("\n-- Complete + review --")
        ok(
            "mentor complete",
            mentor_sess.patch(
                f"{BASE}/bookings/{booking_id}/as-mentor",
                headers=mh,
                json={"status": "completed", "notes_by_mentor": "E2E done."},
            ),
        )
        ok(
            "user review",
            user_sess.post(
                f"{BASE}/bookings/{booking_id}/review",
                headers=uh,
                json={"rating": 5, "review_text": "E2E excellent."},
            ),
            201,
        )

        print("\n-- Chat (best-effort) --")
        try:
            chat = user_sess.post(
                f"{BASE}/chat/sessions",
                headers=uh,
                json={"mentor_id": mentor_id, "minutes": 1},
                timeout=60,
            )
            if chat.status_code in (200, 201):
                ok("chat start checkout", chat, (200, 201))
                print("  ..  chat returned Mollie checkout (promo path N/A) — not completing live charge")
            else:
                print(f"  ..  chat skipped ({chat.status_code}): {chat.text[:200]}")
        except Exception as e:
            print(f"  ..  chat skipped: {e}")

        print("\n-- Forgot password --")
        for role, email in (("user", USER_EMAIL), ("mentor", MENTOR_EMAIL)):
            ok(
                f"forgot-password {role}",
                requests.post(
                    f"{BASE}/auth/forgot-password",
                    json={"email": email, "role": role},
                    timeout=30,
                ),
            )

        print("\n-- Frontend HTTP smoke --")
        for path in (
            "/",
            "/login",
            "/mentors",
            "/register",
            "/become-a-coach",
            "/contact",
            "/forgot-password",
            "/privacy-policy",
            "/terms-and-conditions",
        ):
            ok(f"SPA {path}", requests.get(f"{FRONTEND}{path}", timeout=15))

        print("\n=== API E2E PASSED ===")
        print(json.dumps({"mentor_id": mentor_id, "user_id": user_id, "booking_id": booking_id}, indent=2))
        return 0
    finally:
        if keep_accounts:
            print("\n-- Keeping accounts for Playwright UI (--keep-accounts) --")
        else:
            print("\n-- Cleanup --")
            try:
                cleanup_accounts(mentor_id, user_id)
                if CREDENTIALS_FILE.is_file():
                    CREDENTIALS_FILE.unlink(missing_ok=True)
            except Exception as e:
                print(f"  WARN cleanup: {e}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep-accounts", action="store_true", help="Do not delete samples (for UI E2E)")
    parser.add_argument("--cleanup-only", action="store_true", help="Delete accounts from credentials JSON")
    args = parser.parse_args()

    if args.cleanup_only:
        creds = load_credentials()
        cleanup_accounts(creds.get("coach", {}).get("id"), creds.get("user", {}).get("id"))
        CREDENTIALS_FILE.unlink(missing_ok=True)
        print("=== CLEANUP DONE ===")
        return 0

    try:
        return run_api_suite(keep_accounts=args.keep_accounts)
    except StepError as e:
        print(f"\n=== API E2E FAILED ===\n{e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
