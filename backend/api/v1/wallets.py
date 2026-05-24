from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_db
from api.deps import get_current_user
from models.user import User
from services.wallet_service import get_or_create_wallet, get_transactions

router = APIRouter(prefix="/wallets", tags=["Wallets"])

class WalletTransactionOut(BaseModel):
    id: str
    type: str
    amount: float
    description: str
    reference_type: Optional[str]
    reference_id: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class WalletOut(BaseModel):
    id: str
    balance: float
    currency: str
    transactions: List[WalletTransactionOut]
    
@router.get("/me", response_model=WalletOut)
def get_my_wallet(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wallet = get_or_create_wallet(db, current_user.id)
    transactions = get_transactions(db, current_user.id, skip, limit)
    
    return WalletOut(
        id=wallet.id,
        balance=float(wallet.balance),
        currency=wallet.currency,
        transactions=[WalletTransactionOut.model_validate(t) for t in transactions]
    )
