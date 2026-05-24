from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class PaginatedMeta(BaseModel):
    total: int
    skip: int
    limit: int


class AdminUserRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    phone_number: str
    account_status: str
    email_verified: bool
    created_at: datetime


class AdminUserList(BaseModel):
    items: list[AdminUserRow]
    total: int
    skip: int
    limit: int


class AdminMentorRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    phone_number: str
    headline: str | None
    status: str
    is_approved: bool
    email_verified: bool
    created_at: datetime


class AdminMentorList(BaseModel):
    items: list[AdminMentorRow]
    total: int
    skip: int
    limit: int


class MentorApprovalUpdateRequest(BaseModel):
    action: Literal["approve", "reject"]
    reason: str | None = None


class AdminBookingRow(BaseModel):
    id: str
    user_id: str
    mentor_id: str
    user_name: str
    mentor_name: str
    booking_date: date
    start_time: time
    end_time: time
    start_at_utc: datetime
    end_at_utc: datetime
    duration: int
    status: str
    payment_status: str
    created_at: datetime


class AdminBookingList(BaseModel):
    items: list[AdminBookingRow]
    total: int
    skip: int
    limit: int


class AdminPaymentRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    booking_id: str
    amount: Decimal
    currency: str
    status: str
    payment_gateway: str
    transaction_id: str | None
    created_at: datetime


class AdminPaymentList(BaseModel):
    items: list[AdminPaymentRow]
    total: int
    skip: int
    limit: int


class AdminReviewRow(BaseModel):
    id: str
    user_id: str
    mentor_id: str
    user_name: str
    mentor_name: str
    booking_id: str
    rating: int
    review_text: str | None
    created_at: datetime


class AdminReviewList(BaseModel):
    items: list[AdminReviewRow]
    total: int
    skip: int
    limit: int


class DateCountPoint(BaseModel):
    date: str
    count: int


class DateAmountPoint(BaseModel):
    date: str
    amount: str


class AnalyticsSummary(BaseModel):
    bookings: int
    new_users: int
    new_mentors: int
    reviews: int
    revenue: str
    total_users: int
    total_mentors: int
    total_payments: int
    paid_payments: int
    pending_payments: int


class AnalyticsResponse(BaseModel):
    period: Literal["day", "week", "month", "year"]
    range_start: datetime
    range_end: datetime
    summary: AnalyticsSummary
    bookings_by_day: list[DateCountPoint]
    payments_by_day: list[DateAmountPoint]
    reviews_by_day: list[DateCountPoint]
    users_by_day: list[DateCountPoint]
    mentors_by_day: list[DateCountPoint]


class AdminSettlementCandidateRow(BaseModel):
    mentor_id: str
    mentor_name: str
    currency: str
    gross_amount: str
    fee_amount: str
    net_amount: str
    item_count: int


class AdminSettlementCandidateList(BaseModel):
    cycle_start: date
    cycle_end: date
    candidates: list[AdminSettlementCandidateRow]


class AdminSettlementGenerateRequest(BaseModel):
    cycle_start: date | None = None
    cycle_end: date | None = None


class AdminSettlementRow(BaseModel):
    id: str
    mentor_id: str
    mentor_name: str
    currency: str
    cycle_start: date
    cycle_end: date
    gross_amount: str
    fee_amount: str
    net_amount: str
    status: str
    provider_batch_ref: str | None
    failure_reason: str | None
    paid_at: datetime | None
    created_at: datetime
    #: True when Mollie Connect is linked, tokens exist, and payouts_enabled (DB snapshot; refresh in Mollie may differ).
    connect_payout_ready: bool = False
    connect_payout_blocked_reason: str | None = None


class AdminSettlementList(BaseModel):
    items: list[AdminSettlementRow]
    total: int
    skip: int
    limit: int


class AdminSettlementItemRow(BaseModel):
    id: str
    source_type: str
    source_id: str
    amount: str
    created_at: datetime


class AdminSettlementDetail(AdminSettlementRow):
    items: list[AdminSettlementItemRow]


class AdminSettlementPayRequest(BaseModel):
    idempotency_key: str | None = None


class AdminWalletAdjustRequest(BaseModel):
    amount: Decimal
    reason: str
    reference_type: str | None = None
    reference_id: str | None = None


class AdminWalletAdjustResponse(BaseModel):
    wallet_id: str
    user_id: str
    balance: str
    transaction_id: str
    transaction_type: str
    amount: str
    created_at: datetime


class AdminWalletUserAnalyticsRow(BaseModel):
    user_id: str
    user_name: str
    user_email: str
    currency: str
    credited_total: str
    debited_total: str
    net_total: str
    transaction_count: int
    last_transaction_at: datetime | None


class AdminWalletAnalyticsResponse(BaseModel):
    items: list[AdminWalletUserAnalyticsRow]
    total_credited: str
    total_debited: str
    total_net: str


class AdminMentorPayoutAccountUpsertRequest(BaseModel):
    provider_name: str
    provider_account_ref: str
    status: str = "verified"


class AdminMentorPayoutAccountOut(BaseModel):
    mentor_id: str
    provider_name: str
    provider_account_ref: str
    status: str
    verified_at: datetime | None
    account_holder_name: str | None = None
    iban: str | None = None
    bic: str | None = None


class AdminMentorBankDetailsPrivateOut(BaseModel):
    mentor_id: str
    has_bank_details: bool
    account_holder_name: str | None = None
    iban: str | None = None
    bic: str | None = None
    status: str
    provider_name: str
    provider_account_ref: str
    verified_at: datetime | None = None
    updated_at: datetime | None = None


class AdminMentorMonthlyInvoiceRow(BaseModel):
    id: str
    mentor_id: str
    mentor_name: str
    invoice_month: date
    gross_revenue: str
    fee_percent: str
    fee_amount: str
    currency: str
    status: str
    mollie_checkout_url: str | None
    paid_at: datetime | None
    reminder_sent_at: datetime | None
    created_at: datetime


class AdminMentorMonthlyInvoiceList(BaseModel):
    items: list[AdminMentorMonthlyInvoiceRow]
    total: int
    skip: int
    limit: int


class AdminPlatformPricingOut(BaseModel):
    id: str
    price_5_min: Decimal
    price_10_min: Decimal
    price_20_min: Decimal
    price_30_min: Decimal
    currency: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AdminPlatformPricingUpdateRequest(BaseModel):
    price_5_min: Decimal
    price_10_min: Decimal
    price_20_min: Decimal
    price_30_min: Decimal
    currency: str
    is_active: bool = False
