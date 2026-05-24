from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    booking_id: str
    amount: Decimal
    currency: str
    payment_gateway: str
    transaction_id: str | None
    status: str
    created_at: datetime
