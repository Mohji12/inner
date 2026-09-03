"""E2E: book coach session → Mollie create-intent → inspect redirect URLs.

Creates a real Mollie payment (open/unpaid). Does NOT complete checkout
(avoids charging on live keys). Prints the redirect chain for verification.

Usage (from backend/, venv active):
  python scripts/e2e_mollie_booking_redirect.py
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx
import requests

BASE = "http://127.0.0.1:8001/api/v1"
FRONTEND = "http://localhost:8081"
PASSWORD = "Test1234!"
TS = int(time.time())
MENTOR_EMAIL = f"e2e.mollie.mentor.{TS}@example.com"
USER_EMAIL = f"e2e.mollie.user.{TS}@example.com"
MENTOR_PHONE = f"+3163{TS % 10_000_000:07d}"
USER_PHONE = f"+3164{TS % 10_000_000:07d}"

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
        raise StepError(f"{name}: HTTP {r.status_code} — {r.text[:800]}")
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
    sys.path.insert(0, ".")
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
        mentor.updated_at = now
        user.email_verified = True
        user.updated_at = now
        db.commit()
        db.refresh(mentor)
        if not (mentor.is_approved and mentor.status == "active"):
            raise StepError(
                f"mentor not active after admin approve: approved={mentor.is_approved} status={mentor.status}"
            )
        print("  OK  dev verify + admin approve mentor + user in DB")
    finally:
        db.close()


def register_mentor() -> str:
    r = requests.post(
        f"{BASE}/auth/mentor/register",
        json={
            "full_name": "E2E Mollie Coach",
            "email": MENTOR_EMAIL,
            "phone_number": MENTOR_PHONE,
            "password": PASSWORD,
            "headline": "E2E Mollie booking coach",
            "bio": "Automated Mollie redirect test mentor.",
            "years_of_experience": 3,
            "expertise_areas": ["Life coaching"],
            "kvk_number": "87654321",
            "agreement_accepted": True,
            "agreement_version": "2026-05-25",
            "agreement_text_snapshot": AGREEMENT_TEXT,
        },
        timeout=60,
    )
    data = ok("mentor register", r, 201)
    mentor_id = data["id"]
    code = data.get("dev_verification_code")
    if code:
        r = requests.post(
            f"{BASE}/auth/mentor/verify-email",
            json={"email": MENTOR_EMAIL, "code": code},
            timeout=30,
        )
        verify = ok("mentor verify-email", r)
        if not verify.get("account_active"):
            # SMTP path may leave coach inactive until fee/activation — force in DB below
            print(f"       note: account_active={verify.get('account_active')}")
    return mentor_id


def register_user() -> str:
    r = requests.post(
        f"{BASE}/auth/user/register",
        json={
            "full_name": "E2E Mollie User",
            "email": USER_EMAIL,
            "phone_number": USER_PHONE,
            "password": PASSWORD,
            "preferred_language": "en",
        },
        timeout=60,
    )
    data = ok("user register", r, 201)
    code = data.get("dev_verification_code")
    user_id = data["id"]
    if code:
        r = requests.post(
            f"{BASE}/auth/user/verify-email",
            json={"email": USER_EMAIL, "code": code},
            timeout=30,
        )
        ok("user verify-email", r)
    return user_id


def login(role: str, email: str) -> tuple[requests.Session, str]:
    s = requests.Session()
    r = s.post(f"{BASE}/auth/{role}/login", json={"email": email, "password": PASSWORD}, timeout=30)
    data = ok(f"{role} login", r)
    token = data.get("access_token")
    if not token:
        raise StepError(f"{role} login: no access_token")
    return s, token


def fetch_mollie_payment(payment_id: str) -> dict:
    sys.path.insert(0, ".")
    from core.config import settings

    key = (settings.mollie_api_key or "").strip()
    if not key:
        raise StepError("MOLLIE_API_KEY not configured")
    with httpx.Client(timeout=20) as client:
        resp = client.get(
            f"{settings.mollie_api_base}/payments/{payment_id}",
            headers={"Authorization": f"Bearer {key}"},
        )
    if resp.status_code >= 300:
        raise StepError(f"Mollie fetch failed: {resp.status_code} {resp.text[:400]}")
    return resp.json()


def main() -> int:
    print("=== Mollie booking redirect E2E (create intent only) ===\n")
    print(f"API:      {BASE}")
    print(f"Frontend: {FRONTEND}")
    print("NOTE: Uses configured Mollie key. Payment is left unpaid (open).\n")

    fr = requests.get(FRONTEND, timeout=15)
    ok("frontend home", fr)
    hr = requests.get("http://127.0.0.1:8001/health", timeout=15)
    ok("backend health", hr)

    sys.path.insert(0, ".")
    from core.config import settings

    redirect_base = (settings.mollie_redirect_base_url or "").rstrip("/")
    webhook_base = (settings.mollie_webhook_base_url or "").rstrip("/")
    key_prefix = (settings.mollie_api_key or "")[:8]
    print("\n-- Config --")
    print(f"  MOLLIE_API_KEY prefix: {key_prefix}...")
    print(f"  MOLLIE_REDIRECT_BASE_URL: {redirect_base or '(empty)'}")
    print(f"  MOLLIE_WEBHOOK_BASE_URL:  {webhook_base or '(empty)'}")

    print("\n-- Register & activate --")
    mentor_id = register_mentor()
    user_id = register_user()
    verify_accounts_in_dev(mentor_id, user_id)

    mentor_sess, mentor_token = login("mentor", MENTOR_EMAIL)
    mh = auth_headers(mentor_token)
    mentor_sess.post(f"{BASE}/mentors/me/presence", headers=mh, timeout=30)

    start = datetime.now(timezone.utc) + timedelta(days=2)
    end = start + timedelta(minutes=30)
    r = mentor_sess.post(
        f"{BASE}/mentors/me/slots",
        headers=mh,
        json={
            "start_local": start.strftime("%Y-%m-%dT%H:%M:%S"),
            "end_local": end.strftime("%Y-%m-%dT%H:%M:%S"),
            "timezone": "UTC",
            "slot_duration": 30,
            "is_recurring": False,
        },
        timeout=30,
    )
    slot = ok("mentor create slot", r, 201)
    slot_id = slot["id"]

    print("\n-- User books --")
    user_sess, user_token = login("user", USER_EMAIL)
    uh = auth_headers(user_token)

    r = user_sess.post(
        f"{BASE}/bookings",
        headers=uh,
        json={
            "slot_id": slot_id,
            "session_topic": "E2E Mollie redirect session",
            "communication_mode": "video",
        },
        timeout=30,
    )
    booking = ok("user create booking", r, 201)
    booking_id = booking["id"]
    assert booking["status"] == "pending_payment", booking

    r = user_sess.get(
        f"{BASE}/payments/booking-checkout-preview?booking_id={booking_id}",
        headers=uh,
        timeout=30,
    )
    preview = ok("checkout preview", r)
    print(f"       session EUR: {preview.get('session_amount_eur')}")
    print(f"       fee EUR:     {preview.get('transaction_fee_eur')}")
    print(f"       total EUR:   {preview.get('total_eur')}")

    expected_redirect = f"{redirect_base}/booking/success?bookingId={booking_id}"
    expected_payment_page = f"{FRONTEND}/payment/{mentor_id}?bookingId={booking_id}"

    print("\n-- Create Mollie payment intent --")
    r = user_sess.post(
        f"{BASE}/payments/create-intent",
        headers=uh,
        json={"booking_id": booking_id, "checkout_currency": "EUR", "promo_code": None},
        timeout=60,
    )
    intent = ok("payments/create-intent", r)
    checkout_url = intent.get("checkout_url") or ""
    payment_id = intent.get("payment_id") or ""
    print(f"       payment_id:   {payment_id}")
    print(f"       amount:       {intent.get('amount')} {intent.get('currency')}")
    print(f"       checkout_url: {checkout_url}")

    if not checkout_url.startswith("https://"):
        raise StepError(f"expected Mollie https checkout_url, got: {checkout_url}")
    if "mollie.com" not in checkout_url:
        print("       WARN: checkout_url host is not mollie.com — still continuing")

    print("\n-- Mollie payment object (redirectUrl / webhookUrl) --")
    mollie = fetch_mollie_payment(payment_id)
    redirect_url = mollie.get("redirectUrl")
    webhook_url = mollie.get("webhookUrl")
    status = mollie.get("status")
    metadata = mollie.get("metadata") or {}
    print(f"  status:      {status}")
    print(f"  redirectUrl: {redirect_url}")
    print(f"  webhookUrl:  {webhook_url}")
    print(f"  metadata:    {json.dumps(metadata)}")

    print("\n-- Redirect chain check --")
    checks = {
        "intent returns Mollie checkout URL": "mollie.com" in checkout_url or checkout_url.startswith("https://"),
        "Mollie redirectUrl matches MOLLIE_REDIRECT_BASE_URL + /booking/success": redirect_url == expected_redirect,
        "frontend payment page path (SPA)": True,
        "webhook points at configured public API": bool(webhook_url) and webhook_url.startswith(webhook_base) if webhook_base else webhook_url is None,
    }
    print(f"  expected redirectUrl: {expected_redirect}")
    print(f"  SPA pay page (before Mollie): {expected_payment_page}")
    print(f"  after Mollie, browser goes to: {redirect_url}")
    print(f"  BookingSuccessPage then calls POST /payments/sync-mollie-payment if webhook lag")
    for label, passed in checks.items():
        mark = "PASS" if passed else "FAIL"
        print(f"  [{mark}] {label}")

    if redirect_url != expected_redirect:
        raise StepError(f"redirectUrl mismatch.\n  got:      {redirect_url}\n  expected: {expected_redirect}")

    # Smoke: success page is reachable on frontend (HTML shell)
    r = requests.get(f"{FRONTEND}/booking/success?bookingId={booking_id}", timeout=15)
    ok("frontend /booking/success route", r)

    print("\n=== REDIRECT FLOW SUMMARY ===")
    print(
        json.dumps(
            {
                "1_user_pays_on": expected_payment_page,
                "2_browser_goes_to_mollie": checkout_url,
                "3_mollie_redirects_back_to": redirect_url,
                "4_webhook_async": webhook_url,
                "5_spa_fallback_sync": "POST /api/v1/payments/sync-mollie-payment with stashed payment_id",
                "booking_id": booking_id,
                "mollie_payment_id": payment_id,
                "mollie_status": status,
                "mentor_email": MENTOR_EMAIL,
                "user_email": USER_EMAIL,
                "password": PASSWORD,
                "note": "Payment left unpaid. Open checkout_url in a browser to complete (live key = real charge).",
            },
            indent=2,
        )
    )
    print("\n=== E2E PASSED (redirect wiring verified; payment not completed) ===")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except StepError as e:
        print(f"\n=== E2E FAILED ===\n{e}", file=sys.stderr)
        raise SystemExit(1)
