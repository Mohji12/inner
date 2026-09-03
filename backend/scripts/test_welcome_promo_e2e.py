"""WELCOME5 promo smoke tests against a running API (local or production).

Usage:
  E2E_API=https://life.mijnlevenspad.com/api/v1 python scripts/test_welcome_promo_e2e.py
  E2E_API=http://127.0.0.1:8001/api/v1 python scripts/test_welcome_promo_e2e.py
"""
from __future__ import annotations

import os
import sys
import time

import requests

BASE = os.getenv("E2E_API", "http://127.0.0.1:8001/api/v1").rstrip("/")
PASSWORD = "Test1234!"
TS = int(time.time())
USER_EMAIL = os.getenv("WELCOME_TEST_EMAIL", f"welcome.e2e.{TS}@example.com")
USER_PHONE = f"+3163{TS % 10_000_000:07d}"


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


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_and_login() -> str:
    r = requests.post(
        f"{BASE}/auth/user/register",
        json={
            "full_name": "Welcome E2E User",
            "email": USER_EMAIL,
            "phone_number": USER_PHONE,
            "password": PASSWORD,
            "preferred_language": "en",
        },
        timeout=60,
    )
    if r.status_code in (200, 201):
        reg = ok("register user", r, (200, 201))
        dev_code = reg.get("dev_verification_code")
        if dev_code:
            ok(
                "verify email (dev code)",
                requests.post(
                    f"{BASE}/auth/user/verify-email",
                    json={"email": USER_EMAIL, "code": dev_code},
                    timeout=60,
                ),
            )
        else:
            print("  ..  no dev_verification_code — use scripts/verify_user_prod_smoke.py on EC2 for production")
    elif r.status_code in (400, 409):
        print(f"  ..  account exists ({r.status_code}), logging in")
    else:
        ok("register user", r, (200, 201))

    login = ok(
        "login user",
        requests.post(
            f"{BASE}/auth/user/login",
            json={"email": USER_EMAIL, "password": PASSWORD},
            timeout=60,
        ),
    )
    token = login.get("access_token")
    if not token:
        raise StepError("login did not return access_token")
    return token


def main() -> int:
    print(f"=== WELCOME5 promo E2E @ {BASE} ===")
    print(f"User: {USER_EMAIL}")

    token = register_and_login()
    h = auth(token)

    promo = ok(
        "GET /users/me/welcome-promo",
        requests.get(f"{BASE}/users/me/welcome-promo", headers=h, timeout=60),
    )
    if not promo.get("eligible"):
        print(f"  WARN welcome promo not eligible: {promo}")
    else:
        assert promo.get("code") == "WELCOME5", promo
        assert promo.get("duration_minutes") == 5, promo

    mentors = ok("GET /mentors", requests.get(f"{BASE}/mentors?limit=1", timeout=60))
    items = mentors if isinstance(mentors, list) else mentors.get("items") or mentors.get("mentors") or []
    if not items:
        print("  SKIP validate promo — no public mentors")
        return 0
    mentor_id = items[0]["id"] if isinstance(items[0], dict) else items[0].id

    valid5 = ok(
        "validate WELCOME5 for 5 min",
        requests.post(
            f"{BASE}/promo-codes/validate",
            headers=h,
            json={"code": "WELCOME5", "amount": 4.5, "mentor_id": mentor_id, "duration_minutes": 5},
            timeout=60,
        ),
    )
    if not valid5.get("is_valid"):
        raise StepError(f"5-min promo should be valid: {valid5}")
    if float(valid5.get("final_amount", 99)) > 0.01:
        raise StepError(f"expected free checkout, got final_amount={valid5.get('final_amount')}")

    invalid10 = ok(
        "validate WELCOME5 for 10 min (reject)",
        requests.post(
            f"{BASE}/promo-codes/validate",
            headers=h,
            json={"code": "WELCOME5", "amount": 9.0, "mentor_id": mentor_id, "duration_minutes": 10},
            timeout=60,
        ),
    )
    if invalid10.get("is_valid"):
        raise StepError("10-min booking should reject WELCOME5")

    print("=== WELCOME5 promo E2E passed ===")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except StepError as e:
        print(f"FAILED: {e}", file=sys.stderr)
        raise SystemExit(1)
