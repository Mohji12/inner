"""Local E2E: mentor creates slot → user books → pay (dev) → complete → review."""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta, timezone

import requests

BASE = "http://127.0.0.1:8000/api/v1"
FRONTEND = "http://localhost:8081"
PASSWORD = "Test1234!"
TS = int(time.time())
MENTOR_EMAIL = f"e2e.mentor.{TS}@example.com"
USER_EMAIL = f"e2e.user.{TS}@example.com"
MENTOR_PHONE = f"+3161{TS % 10_000_000:07d}"
USER_PHONE = f"+3162{TS % 10_000_000:07d}"

AGREEMENT_TEXT = """Coach Agreement

By registering as a coach on this platform, you agree to the following payment terms:

1) Metered chat: you receive 70% of the gross per-minute rate (billed per minute/second), including your own tax obligations; the platform retains 30% as platform charges.
2) Users also pay a fixed €0.50 transaction fee per chat session to the platform (not split with coaches).

You acknowledge and accept these terms at the time of registration.
"""


class StepError(RuntimeError):
    pass


def ok(name: str, r: requests.Response, expect: int | tuple[int, ...] = 200) -> dict:
    codes = (expect,) if isinstance(expect, int) else expect
    if r.status_code not in codes:
        raise StepError(f"{name}: HTTP {r.status_code} — {r.text[:500]}")
    print(f"  OK  {name} ({r.status_code})")
    if not r.text:
        return {}
    try:
        return r.json()
    except Exception:
        return {}


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def verify_accounts_in_dev(mentor_id: str, user_id: str) -> None:
    """When SMTP is on, OTP is emailed — for local E2E we verify directly in DB."""
    sys.path.insert(0, ".")
    from datetime import datetime, timezone
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
        user.email_verified = True
        user.updated_at = now
        db.commit()
        db.refresh(mentor)
        if not (mentor.is_approved and mentor.status == "active"):
            raise StepError(f"mentor not active after dev verify: approved={mentor.is_approved} status={mentor.status}")
        print("  OK  dev verify mentor + user in DB")
    finally:
        db.close()


def register_mentor() -> str:
    r = requests.post(
        f"{BASE}/auth/mentor/register",
        json={
            "full_name": "E2E Test Coach",
            "email": MENTOR_EMAIL,
            "phone_number": MENTOR_PHONE,
            "password": PASSWORD,
            "headline": "E2E spiritual coach",
            "bio": "Automated end-to-end test mentor account.",
            "years_of_experience": 3,
            "expertise_areas": ["Life coaching"],
            "agreement_accepted": True,
            "agreement_version": "2026-05-25",
            "agreement_text_snapshot": AGREEMENT_TEXT,
        },
    )
    data = ok("mentor register", r, 201)
    mentor_id = data["id"]
    code = data.get("dev_verification_code")
    if code:
        r = requests.post(
            f"{BASE}/auth/mentor/verify-email",
            json={"email": MENTOR_EMAIL, "code": code},
        )
        verify = ok("mentor verify-email", r)
        if not verify.get("account_active"):
            raise StepError(f"mentor not active after verify: {verify}")
    return mentor_id


def register_user() -> str:
    r = requests.post(
        f"{BASE}/auth/user/register",
        json={
            "full_name": "E2E Test User",
            "email": USER_EMAIL,
            "phone_number": USER_PHONE,
            "password": PASSWORD,
            "preferred_language": "en",
        },
    )
    data = ok("user register", r, 201)
    code = data.get("dev_verification_code")
    user_id = data["id"]
    if code:
        r = requests.post(
            f"{BASE}/auth/user/verify-email",
            json={"email": USER_EMAIL, "code": code},
        )
        ok("user verify-email", r)
    return user_id


def login(role: str, email: str) -> tuple[requests.Session, str]:
    s = requests.Session()
    path = f"/auth/{role}/login"
    r = s.post(f"{BASE}{path}", json={"email": email, "password": PASSWORD})
    data = ok(f"{role} login", r)
    token = data.get("access_token")
    if not token:
        raise StepError(f"{role} login: no access_token")
    return s, token


def dev_mark_booking_paid(booking_id: str, user_id: str) -> None:
    """Finalize payment in local dev without Mollie checkout."""
    sys.path.insert(0, ".")
    from database import SessionLocal
    from decimal import Decimal
    from datetime import datetime, timezone
    from core.security import new_uuid
    from models.booking import Booking
    from models.payment import Payment
    from services.mollie_service import _mark_booking_paid

    db = SessionLocal()
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise StepError(f"booking {booking_id} not found in DB")
        payment = Payment(
            id=new_uuid(),
            user_id=user_id,
            booking_id=booking.id,
            amount=Decimal("35.50"),
            amount_base_eur=Decimal("35.00"),
            currency="EUR",
            payment_gateway="e2e_dev",
            transaction_id=f"e2e_{new_uuid().replace('-', '')}",
            status="pending",
            created_at=datetime.now(timezone.utc),
        )
        db.add(payment)
        db.flush()
        _mark_booking_paid(db, payment)
        db.commit()
        print(f"  OK  dev mark booking paid ({payment.id})")
    finally:
        db.close()


def main() -> int:
    print("=== Mijn Levenspad local E2E ===\n")

    # Frontend + API reachability
    fr = requests.get(FRONTEND, timeout=10)
    ok("frontend home", fr)
    hr = requests.get("http://127.0.0.1:8000/health", timeout=10)
    ok("backend health", hr)

    print("\n-- Mentor flow --")
    mentor_id = register_mentor()
    user_id = register_user()
    verify_accounts_in_dev(mentor_id, user_id)
    mentor_sess, mentor_token = login("mentor", MENTOR_EMAIL)
    h = auth_headers(mentor_token)

    r = mentor_sess.post(f"{BASE}/mentors/me/presence", headers=h)
    ok("mentor presence heartbeat", r, 204)

    start = datetime.now(timezone.utc) + timedelta(days=2)
    end = start + timedelta(minutes=30)
    r = mentor_sess.post(
        f"{BASE}/mentors/me/slots",
        headers=h,
        json={
            "start_local": start.strftime("%Y-%m-%dT%H:%M:%S"),
            "end_local": end.strftime("%Y-%m-%dT%H:%M:%S"),
            "timezone": "UTC",
            "slot_duration": 30,
            "is_recurring": False,
        },
    )
    slot = ok("mentor create slot", r, 201)
    slot_id = slot["id"]

    r = mentor_sess.get(f"{BASE}/mentors/me/slots", headers=h)
    slots = ok("mentor list slots", r)
    if not any(s["id"] == slot_id for s in slots):
        raise StepError("created slot not in mentor slot list")

    print("\n-- User flow --")
    user_sess, user_token = login("user", USER_EMAIL)
    uh = auth_headers(user_token)

    r = requests.get(f"{BASE}/mentors")
    mentors = ok("public mentor directory", r)
    if not any(m["id"] == mentor_id for m in mentors):
        raise StepError("E2E mentor not visible in public directory")

    r = requests.get(f"{BASE}/mentors/{mentor_id}/slots")
    public_slots = ok("public mentor slots", r)
    if not any(s["id"] == slot_id for s in public_slots):
        raise StepError("E2E slot not visible publicly")

    r = user_sess.post(
        f"{BASE}/bookings",
        headers=uh,
        json={
            "slot_id": slot_id,
            "session_topic": "E2E clarity session",
            "communication_mode": "video",
        },
    )
    booking = ok("user create booking", r, 201)
    booking_id = booking["id"]
    assert booking["status"] == "pending_payment", booking

    r = user_sess.get(f"{BASE}/payments/booking-checkout-preview?booking_id={booking_id}", headers=uh)
    preview = ok("checkout preview", r)
    print(f"       checkout total EUR: {preview.get('total_eur')}")

    dev_mark_booking_paid(booking_id, user_id)

    r = user_sess.get(f"{BASE}/bookings/me", headers=uh)
    my_bookings = ok("user list bookings", r)
    paid = next((b for b in my_bookings if b["id"] == booking_id), None)
    if not paid or paid.get("payment_status") != "paid":
        raise StepError(f"booking not paid after dev finalize: {paid}")

    print("\n-- Mentor completes session --")
    r = mentor_sess.patch(
        f"{BASE}/bookings/{booking_id}/as-mentor",
        headers=h,
        json={"status": "completed", "notes_by_mentor": "Great E2E session."},
    )
    completed = ok("mentor mark completed", r)
    assert completed["status"] == "completed", completed

    r = mentor_sess.get(f"{BASE}/bookings/mentor/me", headers=h)
    mentor_bookings = ok("mentor list bookings", r)
    if not any(b["id"] == booking_id and b["status"] == "completed" for b in mentor_bookings):
        raise StepError("completed booking missing from mentor list")

    print("\n-- User leaves review --")
    r = user_sess.post(
        f"{BASE}/bookings/{booking_id}/review",
        headers=uh,
        json={"rating": 5, "review_text": "E2E test — excellent session."},
    )
    review = ok("user submit review", r, 201)
    assert review.get("rating") == 5, review

    # Frontend routes (smoke)
    for path in ["/login", "/mentors", "/register", "/become-a-coach"]:
        r = requests.get(f"{FRONTEND}{path}", timeout=15)
        ok(f"frontend {path}", r)

    print("\n=== E2E PASSED ===")
    print(json.dumps({
        "mentor_email": MENTOR_EMAIL,
        "user_email": USER_EMAIL,
        "password": PASSWORD,
        "mentor_id": mentor_id,
        "booking_id": booking_id,
        "slot_id": slot_id,
    }, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except StepError as e:
        print(f"\n=== E2E FAILED ===\n{e}", file=sys.stderr)
        raise SystemExit(1)
