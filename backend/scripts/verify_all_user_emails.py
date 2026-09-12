"""Mark all users as email_verified=True (admin Users list shows Yes).

Usage (from backend/):
  .venv/Scripts/python.exe scripts/verify_all_user_emails.py
"""

from datetime import datetime, timezone

from db.session import SessionLocal
from models.user import User


def main() -> None:
    db = SessionLocal()
    try:
        total = db.query(User).count()
        unverified = db.query(User).filter(User.email_verified.is_(False)).count()
        print(f"total={total} unverified={unverified}")
        if unverified == 0:
            print("Nothing to update.")
            return
        now = datetime.now(timezone.utc)
        updated = (
            db.query(User)
            .filter(User.email_verified.is_(False))
            .update({User.email_verified: True, User.updated_at: now}, synchronize_session=False)
        )
        db.commit()
        print(f"updated={updated}")
        still = db.query(User).filter(User.email_verified.is_(False)).count()
        print(f"still_unverified={still}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
