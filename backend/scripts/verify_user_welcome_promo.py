"""Verify WELCOME5 validate_promo_code for a user email."""
import sys
from decimal import Decimal

from db.session import SessionLocal
from models.user import User
from services.promo_service import PromoError, validate_promo_code
from services.welcome_promo_service import welcome_promo_eligibility


def main() -> None:
    email = (sys.argv[1] if len(sys.argv) > 1 else "").strip().lower()
    if not email:
        print("usage: verify_user_welcome_promo.py <email>")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print("USER_NOT_FOUND")
            sys.exit(1)
        print("ELIGIBILITY", welcome_promo_eligibility(db, user.id))
        try:
            promo = validate_promo_code(
                db,
                "WELCOME5",
                Decimal("5.50"),
                user.id,
                None,
                scope="chat",
                duration_minutes=5,
            )
            print("VALIDATE_OK", promo.code)
        except PromoError as e:
            print("VALIDATE_FAIL", str(e))
            sys.exit(2)
    finally:
        db.close()


if __name__ == "__main__":
    main()
