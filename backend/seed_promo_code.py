import sys
from datetime import datetime, timezone
import uuid
from decimal import Decimal
import logging

from database import SessionLocal
from models.promo_code import PromoCode

logging.basicConfig(level=logging.INFO)

def seed_promo_code():
    db = SessionLocal()
    try:
        code_name = "LIFE100"
        promo = db.query(PromoCode).filter(PromoCode.code == code_name).first()
        if promo:
            logging.info(f"Promo code {code_name} already exists.")
            return
            
        new_promo = PromoCode(
            id=str(uuid.uuid4()),
            code=code_name,
            discount_type="percentage",
            discount_value=Decimal("100.00"),
            scope="all",
            is_active=True,
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_promo)
        db.commit()
        logging.info(f"Successfully created promo code {code_name}.")
    except Exception as e:
        logging.error(f"Failed to create promo code: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_promo_code()
