"""Structured invoice payloads for bookings and coach platform fees (JSON + print UI)."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BookingInvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: str = Field(default="booking_session")
    invoice_number: str
    issued_at: datetime
    platform_legal_name: str
    platform_contact_email: str
    booking_id: str
    session_start_at_utc: datetime
    session_end_at_utc: datetime
    duration_minutes: int
    booking_status: str
    session_topic: str | None = None
    bill_to_name: str
    bill_to_email: str
    mentor_name: str
    mentor_email: str
    line_description: str
    payment_status: str
    payment_currency: str
    payment_amount: str
    amount_base_eur: str | None = None
    transaction_id: str | None = None


class MentorMonthlyFeeStatementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: str = Field(default="mentor_monthly_platform_fee")
    invoice_number: str
    invoice_id: str
    issued_at: datetime
    platform_legal_name: str
    platform_contact_email: str
    coach_name: str
    coach_email: str
    invoice_month: str
    gross_revenue: Decimal
    fee_percent: Decimal
    fee_amount: Decimal
    currency: str
    status: str
    paid_at: datetime | None
    created_at: datetime
    checkout_amount: Decimal | None = None
    checkout_currency: str | None = None
    fee_fx_rate: Decimal | None = None
    mollie_payment_id: str | None = None


class MentorOnboardingInvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: str = Field(default="mentor_onboarding_fee")
    invoice_number: str
    payment_id: str
    issued_at: datetime
    platform_legal_name: str
    platform_contact_email: str
    coach_name: str
    coach_email: str
    line_description: str
    amount: Decimal
    currency: str
    status: str
    paid_at: datetime | None
    created_at: datetime
    mollie_payment_id: str
