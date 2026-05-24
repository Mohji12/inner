from decimal import Decimal
from sqlalchemy.orm import Session

from core.security import new_uuid
from models.wallet import Wallet, WalletTransaction
from core.config import settings

class WalletError(Exception):
    pass

def get_or_create_wallet(db: Session, user_id: str) -> Wallet:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        wallet = Wallet(
            id=new_uuid(),
            user_id=user_id,
            balance=Decimal("0.00"),
            currency=settings.payment_currency
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet

def credit_wallet(
    db: Session, 
    user_id: str, 
    amount: Decimal, 
    description: str, 
    reference_type: str = None, 
    reference_id: str = None,
    admin_actor_id: str | None = None,
    admin_actor_role: str | None = None,
) -> WalletTransaction:
    if amount <= 0:
        raise WalletError("Credit amount must be positive")
        
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
    if not wallet:
        wallet = get_or_create_wallet(db, user_id)
        # re-fetch with for_update
        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
        
    wallet.balance += amount
    
    transaction = WalletTransaction(
        id=new_uuid(),
        wallet_id=wallet.id,
        type="credit",
        amount=amount,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
        admin_actor_id=admin_actor_id,
        admin_actor_role=admin_actor_role,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction

def debit_wallet(
    db: Session, 
    user_id: str, 
    amount: Decimal, 
    description: str, 
    reference_type: str = None, 
    reference_id: str = None,
    admin_actor_id: str | None = None,
    admin_actor_role: str | None = None,
) -> WalletTransaction:
    if amount <= 0:
        raise WalletError("Debit amount must be positive")
        
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
    if not wallet:
        wallet = get_or_create_wallet(db, user_id)
        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
        
    if wallet.balance < amount:
        raise WalletError("Insufficient funds")
        
    wallet.balance -= amount
    
    transaction = WalletTransaction(
        id=new_uuid(),
        wallet_id=wallet.id,
        type="debit",
        amount=amount,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
        admin_actor_id=admin_actor_id,
        admin_actor_role=admin_actor_role,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction

def get_transactions(db: Session, user_id: str, skip: int = 0, limit: int = 50):
    wallet = get_or_create_wallet(db, user_id)
    return db.query(WalletTransaction).filter(WalletTransaction.wallet_id == wallet.id).order_by(WalletTransaction.created_at.desc()).offset(skip).limit(limit).all()
