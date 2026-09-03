"""Production smoke: WELCOME5 row, manual_occupied column, redemption table."""
from __future__ import annotations

from sqlalchemy import inspect, text

from database import SessionLocal, engine
from models.promo_code import PromoCode


def main() -> int:
    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns("mentors")}
    print(f"mentors.manual_occupied={'manual_occupied' in cols}")
    tables = set(insp.get_table_names())
    print(f"promo_code_redemptions={'promo_code_redemptions' in tables}")

    db = SessionLocal()
    try:
        promo = db.query(PromoCode).filter(PromoCode.code == "WELCOME5").first()
        if promo:
            print(
                f"WELCOME5 id={promo.id} duration={promo.allowed_duration_minutes} "
                f"discount={promo.discount_value} active={promo.is_active}"
            )
        else:
            print("WELCOME5_MISSING")
        n = db.execute(text("SELECT COUNT(*) FROM promo_code_redemptions")).scalar()
        print(f"promo_code_redemptions_count={n}")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
