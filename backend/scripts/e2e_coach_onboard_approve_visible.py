"""E2E: coach register → onboard → admin approve → public card → frontend login.

Uses production API (same as local Vite `VITE_API_URL`) and opens the frontend
in a real browser for coach login.

Usage (from backend/):
  $env:PYTHONPATH = "."
  python scripts/e2e_coach_onboard_approve_visible.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]

API = os.getenv("E2E_API", "https://inner.krintix.in/api/v1").rstrip("/")
FRONTEND = os.getenv("E2E_FRONTEND", "http://127.0.0.1:8081").rstrip("/")
ADMIN_EMAIL = os.getenv("E2E_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("E2E_ADMIN_PASSWORD", "Admin123!")
PASSWORD = "Test1234!"
TS = int(time.time())
MENTOR_EMAIL = f"e2e.coach.onboard.{TS}@example.com"
MENTOR_PHONE = f"+3169{TS % 10_000_000:07d}"
MENTOR_NAME = f"E2E Onboard Coach {TS % 10000}"

AGREEMENT_TEXT = """Coach Agreement

By registering as a coach on this platform, you agree to the following payment terms:

1) Metered chat: you receive 70% of the gross per-minute rate (billed per minute/second), including your own tax obligations; the platform retains 30% as platform charges.
2) Users also pay a fixed €0.50 transaction fee per chat session to the platform (not split with coaches).

You acknowledge and accept these terms at the time of registration.
"""

CREDENTIALS_FILE = ROOT / ".e2e-coach-credentials.json"


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


def wait_frontend(url: str, timeout_s: int = 90) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            r = requests.get(url, timeout=3)
            if r.status_code < 500:
                print(f"  OK  frontend up at {url}")
                return
        except Exception:
            pass
        time.sleep(1)
    raise StepError(f"Frontend not reachable at {url}")


def ensure_frontend_running() -> None:
    try:
        r = requests.get(FRONTEND, timeout=3)
        if r.status_code < 500:
            print(f"  OK  frontend already running ({FRONTEND})")
            return
    except Exception:
        pass

    print(f"  …  starting Vite frontend on {FRONTEND}")
    # Port from FRONTEND URL
    port = "8081"
    if ":" in FRONTEND.rsplit("/", 1)[-1]:
        port = FRONTEND.rsplit(":", 1)[-1]
    subprocess.Popen(
        ["npx", "vite", "--port", port, "--host", "127.0.0.1"],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=True,
    )
    wait_frontend(FRONTEND)


def verify_email_in_db(mentor_id: str, email: str) -> None:
    """When SMTP is on, OTP is emailed — verify + complete free onboarding in DB."""
    sys.path.insert(0, str(BACKEND))
    from datetime import datetime, timezone

    from db.session import SessionLocal
    from models.mentor import Mentor
    from services.onboarding_payment_service import activate_coach_after_email_verification

    db = SessionLocal()
    try:
        mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
        if not mentor:
            raise StepError(f"Mentor {mentor_id} missing in DB")
        mentor.email_verified = True
        mentor.updated_at = datetime.now(timezone.utc)
        activate_coach_after_email_verification(db, mentor=mentor)
        db.commit()
        db.refresh(mentor)
        print(
            f"  OK  email verified + free onboarding recorded "
            f"(approved={mentor.is_approved}, status={mentor.status})"
        )
        if mentor.is_approved or mentor.status == "active":
            raise StepError("Coach should still be pending admin approval after onboarding")
    finally:
        db.close()


def register_coach() -> str:
    r = requests.post(
        f"{API}/auth/mentor/register",
        json={
            "full_name": MENTOR_NAME,
            "email": MENTOR_EMAIL,
            "phone_number": MENTOR_PHONE,
            "password": PASSWORD,
            "headline": "E2E onboard test coach",
            "bio": "Automated onboarding / approval E2E coach.",
            "years_of_experience": 2,
            "expertise_areas": ["Life coaching", "Meditation"],
            "languages_spoken": ["en", "nl"],
            "kvk_number": "87654321",
            "agreement_accepted": True,
            "agreement_version": "2026-05-25",
            "agreement_text_snapshot": AGREEMENT_TEXT,
            "public_card_visibility": {
                "headline": True,
                "expertise_tags": True,
                "years_experience": True,
                "rating": True,
                "session_packages": True,
                "profile_photo": True,
                "banner_photo": True,
            },
        },
        timeout=60,
    )
    data = ok("coach register", r, 201)
    mentor_id = data["id"]
    code = data.get("dev_verification_code")
    if code:
        r = requests.post(
            f"{API}/auth/mentor/verify-email",
            json={"email": MENTOR_EMAIL, "code": code},
            timeout=30,
        )
        verify = ok("coach verify-email (dev code)", r)
        if verify.get("account_active"):
            print("  !!  account already active after verify (unexpected if admin gate on)")
    else:
        print("  ..  OTP emailed (SMTP on) — admin verify/approve will complete onboarding")
    return mentor_id


def assert_not_public_yet(mentor_id: str) -> None:
    r = requests.get(f"{API}/mentors", params={"approved_only": "true"}, timeout=30)
    rows = ok("list public mentors (before approve)", r)
    ids = {m.get("id") for m in rows}
    if mentor_id in ids:
        raise StepError("Coach should NOT be public before admin approval")
    print("  OK  coach hidden from public list before approval")


def complete_onboarding_via_admin(mentor_id: str) -> None:
    """Verify email (if needed) via admin ops endpoint, then approve."""
    r = requests.post(
        f"{API}/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    data = ok("admin login", r)
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Optional verify-email ops endpoint (newer APIs). Fall back to approve-only.
    vr = requests.post(f"{API}/admin/mentors/{mentor_id}/verify-email", headers=headers, timeout=30)
    if vr.status_code == 200:
        ok("admin verify-email (ops)", vr)
    elif vr.status_code == 404:
        print("  ..  admin verify-email endpoint not deployed — approve will verify if supported")
    else:
        # Older servers may not have this route (404 HTML) — continue to approve.
        print(f"  ..  admin verify-email skipped ({vr.status_code})")

    r = requests.patch(
        f"{API}/admin/mentors/{mentor_id}/approval",
        headers=headers,
        json={"action": "approve"},
        timeout=30,
    )
    row = ok("admin approve coach", r)
    if not row.get("is_approved") or row.get("status") != "active":
        raise StepError(f"Approve did not activate coach: {row}")
    if not row.get("email_verified"):
        raise StepError("Coach still email_verified=false after admin approve")
    print(f"  OK  coach approved — status={row.get('status')} email_verified={row.get('email_verified')}")


def assert_public_visible(mentor_id: str) -> dict:
    r = requests.get(f"{API}/mentors", params={"approved_only": "true"}, timeout=30)
    rows = ok("list public mentors (after approve)", r)
    match = next((m for m in rows if m.get("id") == mentor_id), None)
    if not match:
        # Also try detail endpoint
        d = requests.get(f"{API}/mentors/{mentor_id}", timeout=30)
        if d.status_code != 200:
            raise StepError(f"Coach not in public list and detail failed: {d.status_code} {d.text[:300]}")
        match = d.json()
        print("  OK  coach detail public (may be ranked off first page of list)")
    else:
        print(f"  OK  coach card visible — name={match.get('full_name')!r}")
    return match


def api_coach_login() -> str:
    r = requests.post(
        f"{API}/auth/mentor/login",
        json={"email": MENTOR_EMAIL, "password": PASSWORD},
        timeout=30,
    )
    data = ok("coach API login", r)
    token = data.get("access_token")
    if not token:
        raise StepError("coach login returned no access_token")
    return token


def save_credentials(mentor_id: str) -> None:
    payload = {
        "mentor_id": mentor_id,
        "email": MENTOR_EMAIL,
        "password": PASSWORD,
        "full_name": MENTOR_NAME,
        "frontend_login": f"{FRONTEND}/login?role=mentor",
        "api": API,
    }
    CREDENTIALS_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"  OK  wrote credentials → {CREDENTIALS_FILE}")


def browser_login() -> None:
    """Open frontend and log in as the new coach with Playwright (headed)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  !!  playwright not installed — opening login page in default browser")
        webbrowser.open(f"{FRONTEND}/login?role=mentor")
        print(f"      Log in manually: {MENTOR_EMAIL} / {PASSWORD}")
        return

    login_url = f"{FRONTEND}/login?role=mentor"
    print(f"  …  opening browser → {login_url}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=250)
        page = browser.new_page()
        page.goto(login_url, wait_until="domcontentloaded", timeout=60_000)

        # Role may already be mentor via query; ensure coach tab if present
        for label in ("Coach", "Mentor", "coach", "mentor"):
            loc = page.get_by_role("button", name=label)
            if loc.count():
                loc.first.click()
                break

        page.locator("#email, input[type='email'], input[name='email']").first.fill(MENTOR_EMAIL)
        page.locator("#password, input[type='password'], input[name='password']").first.fill(PASSWORD)
        # Prefer explicit submit; fall back to role-based match.
        submit = page.locator("button[type='submit']")
        if submit.count():
            submit.first.click()
        else:
            page.get_by_role(
                "button",
                name=lambda n: bool(n) and any(x in n.lower() for x in ("login", "sign in", "log in")),
            ).first.click()

        page.wait_for_url("**/mentor**", timeout=45_000)
        print(f"  OK  browser login landed on {page.url}")
        # Keep browser open so the logged-in dashboard is visible
        page.wait_for_timeout(12000)
        browser.close()


def main() -> int:
    print("=== E2E: coach onboard -> admin approve -> visible -> login ===")
    print(f"API={API}")
    print(f"FRONTEND={FRONTEND}")
    print(f"Coach={MENTOR_EMAIL}")

    ensure_frontend_running()

    print("\n1) Register coach")
    mentor_id = register_coach()

    print("\n2) Confirm not public before approval")
    assert_not_public_yet(mentor_id)

    print("\n3) Admin verify + approve")
    complete_onboarding_via_admin(mentor_id)

    print("\n4) Confirm public card visible")
    assert_public_visible(mentor_id)

    print("\n5) Coach API login")
    api_coach_login()

    save_credentials(mentor_id)

    print("\n6) Frontend browser login")
    try:
        browser_login()
    except Exception as e:
        print(f"  !!  browser login step failed: {e}")
        webbrowser.open(f"{FRONTEND}/login?role=mentor")
        print(f"      Manual login: {MENTOR_EMAIL} / {PASSWORD}")
        return 1

    print("\n=== ALL STEPS PASSED ===")
    print(f"Email:    {MENTOR_EMAIL}")
    print(f"Password: {PASSWORD}")
    print(f"Login:    {FRONTEND}/login?role=mentor")
    print(f"Mentors:  {FRONTEND}/mentors")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except StepError as e:
        print(f"\nFAIL: {e}", file=sys.stderr)
        raise SystemExit(1)
