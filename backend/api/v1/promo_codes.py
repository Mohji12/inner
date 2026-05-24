from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from api.deps import get_current_user
from models.user import User
from services.promo_service import validate_promo_code, calculate_discount, PromoError
from services.pricing_service import booking_transaction_fee_eur

router = APIRouter(prefix="/promo-codes", tags=["Promo Codes"])

class ValidatePromoRequest(BaseModel):
    code: str
    amount: float
    mentor_id: str | None = None

class ValidatePromoResponse(BaseModel):
    is_valid: bool
    discount_amount: float
    session_amount: float
    transaction_fee: float
    final_amount: float
    message: str | None = None

@router.post("/validate", response_model=ValidatePromoResponse)
def validate_promo(
    req: ValidatePromoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction_fee = booking_transaction_fee_eur()
    session_amount = Decimal(str(req.amount))
    total_due = session_amount + transaction_fee
    try:
        promo = validate_promo_code(db, req.code, total_due, current_user.id, req.mentor_id)
        discount = calculate_discount(promo, total_due)
        final_amount = max(Decimal("0.0"), total_due - discount)

        return ValidatePromoResponse(
            is_valid=True,
            discount_amount=float(discount),
            session_amount=float(session_amount),
            transaction_fee=float(transaction_fee),
            final_amount=float(final_amount),
        )
    except PromoError as e:
        return ValidatePromoResponse(
            is_valid=False,
            discount_amount=0.0,
            session_amount=float(session_amount),
            transaction_fee=float(transaction_fee),
            final_amount=float(total_due),
            message=str(e),
        )
