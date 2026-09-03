"""One-off: verify disposable E2E user on production and send welcome promo email."""
from __future__ import annotations

import sys
from datetime import datetime, timezone

from database import SessionLocal
from models.user import User
from services.welcome_promo_service import get_welcome_promo_row, send_user_welcome_promo_email


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: verify_user_prod_smoke.py <email>")
        return 1
    email = sys.argv[1].lower()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print("USER_NOT_FOUND")
            return 1
        user.email_verified = True
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        promo = get_welcome_promo_row(db)
        if promo:
            send_user_welcome_promo_email(
                to_email=user.email,
                full_name=user.full_name,
                code=promo.code,
                duration_minutes=promo.allowed_duration_minutes or 5,
                preferred_language=user.preferred_language,
            )
            print(f"VERIFIED_AND_WELCOME_EMAIL_SENT code={promo.code}")
        else:
            print("VERIFIED_NO_PROMO_ROW")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
