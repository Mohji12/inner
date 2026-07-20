"""Smoke-test platform redirections (SPA routes + API auth/Mollie redirect URLs).

Run with API on 8001 and frontend on 8081:
  python scripts/smoke_redirects.py
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

API = os.getenv("SMOKE_API", "http://127.0.0.1:8001")
API_V1 = f"{API.rstrip('/')}/api/v1"
FRONTEND = os.getenv("SMOKE_FRONTEND", "http://localhost:8081")

PASS = 0
FAIL = 0


def report(ok: bool, name: str, detail: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  PASS  {name}" + (f" - {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  FAIL  {name}" + (f" - {detail}" if detail else ""))


def check_http(name: str, url: str, expect: int | tuple[int, ...] = 200) -> requests.Response | None:
    codes = (expect,) if isinstance(expect, int) else expect
    try:
        r = requests.get(url, timeout=15, allow_redirects=True)
    except requests.RequestException as e:
        report(False, name, str(e))
        return None
    report(r.status_code in codes, name, f"HTTP {r.status_code}")
    return r


def check_frontend_spa_routes() -> None:
    print("\n== Frontend SPA routes ==")
    routes = [
        "/",
        "/login",
        "/login?role=mentor",
        "/login?role=user",
        "/login?role=admin",
        "/register",
        "/booking/thank-you",
        "/mentors",
        "/become-a-coach",
        "/mentor/dashboard",  # protected — SPA still serves index
        "/user/dashboard",
        "/admin",
        "/mentor/settlements",
    ]
    for path in routes:
        check_http(f"GET {path}", f"{FRONTEND}{path}")


def check_source_redirect_wiring() -> None:
    print("\n== Source wiring (login / switch / protect) ==")
    src = ROOT.parent / "src"
    if not src.exists():
        src = ROOT.parent  # fallback
        # repo root is parent of backend
        src = Path(__file__).resolve().parents[2] / "src"
    # workspace: backend/scripts -> repo root is parents[2]? 
    # Path: .../backend/scripts/smoke -> parents[0]=scripts, [1]=backend, [2]=repo
    repo = Path(__file__).resolve().parents[2]
    src = repo / "src"

    login = (src / "pages" / "LoginPage.tsx").read_text(encoding="utf-8")
    report("resolvePostLoginPath" in login, "Login uses post-login return URL helper")
    report(
        'finishLogin("/mentor/appointments"' in login or "finishLogin(\"/mentor/appointments\"" in login,
        "Coach login has default appointments fallback",
    )
    report(
        'finishLogin("/user/appointments"' in login,
        "User login redirects to /user/appointments",
    )
    report(
        'finishLogin("/admin"' in login or 'finishLogin("/admin"' in login.replace("'", '"'),
        "Admin login redirects to /admin",
        "check LoginPage for admin finishLogin",
    )
    # re-check admin more carefully
    report("/admin" in login and "admin" in login.lower(), "LoginPage mentions /admin destination")

    protect = (src / "components" / "dashboard" / "ProtectedRoute.tsx").read_text(encoding="utf-8")
    report('/login?role=mentor' in protect, "Protected mentor -> /login?role=mentor")
    report('/login?role=user' in protect, "Protected user -> /login?role=user")
    report('/login?role=admin' in protect, "Protected admin -> /login?role=admin")
    report("location.search" in protect and "from:" in protect, "Protected route saves full return URL")

    mentor_layout = (src / "components" / "dashboard" / "MentorDashboardLayout.tsx").read_text(encoding="utf-8")
    report('to="/"' in mentor_layout and "viewWebsite" in mentor_layout, "Coach dashboard has View website -> /")
    report('to="/login?role=mentor"' in mentor_layout or '"/login?role=mentor"' in mentor_layout, "Coach logout goes to mentor login")

    navbar = (src / "components" / "Navbar.tsx").read_text(encoding="utf-8")
    report('to="/mentor/dashboard"' in navbar, "Navbar Back to dashboard -> /mentor/dashboard")
    report("isCoach" in navbar, "Navbar detects logged-in coach")

    app = (src / "App.tsx").read_text(encoding="utf-8")
    report('path="settlements"' in app and "MentorSettlementsPage" in app, "Coach settlements route registered")
    report('path="/mentor"' in app or 'path="/mentor"' in app.replace("'", '"'), "Mentor layout route present")
    report('path="/booking/thank-you"' in app, "Booking thank-you route registered")
    report("ProtectedRoute role=\"user\"" in app and "PaymentPage" in app, "Payment page requires user auth")


def check_api_health_and_mollie_redirect() -> None:
    print("\n== API health + Mollie redirect config ==")
    r = check_http("API /health", f"{API}/health")
    if r is None:
        return

    # Load settings without requiring full app if possible
    try:
        from core.config import settings

        base = (settings.mollie_redirect_base_url or "").rstrip("/")
        report(bool(base), "MOLLIE_REDIRECT_BASE_URL set", base or "(empty)")
        if base:
            report(
                "localhost" in base or "127.0.0.1" in base or base.startswith("http"),
                "Redirect base looks usable",
                base,
            )
            # Typical booking success path used by payment flow
            sample = f"{base}/booking/thank-you?bookingId=test-id"
            report(sample.startswith("http"), "Sample booking success URL", sample)
    except Exception as e:
        report(False, "Load settings", str(e))


def check_auth_login_redirect_targets() -> None:
    """If demo credentials exist in env, verify login works (redirect is client-side)."""
    print("\n== Auth login (optional credentials) ==")
    mentor_email = os.getenv("SMOKE_MENTOR_EMAIL", "").strip()
    mentor_password = os.getenv("SMOKE_MENTOR_PASSWORD", "").strip()
    user_email = os.getenv("SMOKE_USER_EMAIL", "").strip()
    user_password = os.getenv("SMOKE_USER_PASSWORD", "").strip()

    if not mentor_email or not mentor_password:
        print("  SKIP  mentor login (set SMOKE_MENTOR_EMAIL / SMOKE_MENTOR_PASSWORD)")
    else:
        try:
            r = requests.post(
                f"{API_V1}/auth/mentor/login",
                json={"email": mentor_email, "password": mentor_password},
                timeout=20,
            )
            report(r.status_code == 200, "Mentor login API", f"HTTP {r.status_code}")
            if r.status_code == 200:
                data = r.json()
                report(bool(data.get("access_token") or data.get("two_factor_required")), "Mentor gets token or 2FA")
        except requests.RequestException as e:
            report(False, "Mentor login API", str(e))

    if not user_email or not user_password:
        print("  SKIP  user login (set SMOKE_USER_EMAIL / SMOKE_USER_PASSWORD)")
    else:
        try:
            r = requests.post(
                f"{API_V1}/auth/user/login",
                json={"email": user_email, "password": user_password},
                timeout=20,
            )
            report(r.status_code == 200, "User login API", f"HTTP {r.status_code}")
        except requests.RequestException as e:
            report(False, "User login API", str(e))


def main() -> int:
    print(f"Frontend: {FRONTEND}")
    print(f"API:      {API}")
    t0 = time.time()
    check_frontend_spa_routes()
    check_source_redirect_wiring()
    check_api_health_and_mollie_redirect()
    check_auth_login_redirect_targets()
    print(f"\n== Summary: {PASS} passed, {FAIL} failed in {time.time() - t0:.1f}s ==")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
