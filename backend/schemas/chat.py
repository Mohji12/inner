from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChatSessionStartIn(BaseModel):
    mentor_id: str
    minutes: int = Field(ge=1, le=480)
    checkout_currency: str | None = None


class ChatSessionExtendIn(BaseModel):
    minutes: int = Field(ge=1, le=480)
    checkout_currency: str | None = None


class ChatSessionExtendQuoteOut(BaseModel):
    minutes: int
    rate_per_minute_eur: str
    session_amount_eur: str
    transaction_fee_eur: str
    total_eur: str
    checkout_amount: str
    checkout_currency: str
    fx_rate_used: str | None = None
    min_minutes: int


class ChatSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    mentor_id: str
    status: str
    ends_at: datetime
    remaining_seconds: int
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime | None = None
    unread_count_user: int = 0
    unread_count_mentor: int = 0


class ChatSessionCheckoutOut(BaseModel):
    session: ChatSessionOut
    checkout_url: str
    mollie_payment_id: str


class ChatCallTokenOut(BaseModel):
    provider: str = "livekit"
    url: str
    token: str
    room_name: str
    expires_in_seconds: int


class ChatDialOutOut(BaseModel):
    """LiveKit SIP outbound leg into the session room (PSTN)."""

    participant_id: str
    participant_identity: str
    room_name: str
    sip_call_id: str = ""
    dialed_phone_e164: str


class ChatPhoneBridgeIn(BaseModel):
    number_a: str
    number_b: str
    label_a: str | None = None
    label_b: str | None = None


class ChatPhoneBridgeLegOut(BaseModel):
    participant_id: str | None = None
    participant_identity: str | None = None
    sip_call_id: str | None = None
    dialed_phone_e164: str
    status: str
    error: str | None = None


class ChatPhoneBridgeOut(BaseModel):
    bridge_session_id: str
    room_name: str
    status: str
    actor_role: str
    leg_a: ChatPhoneBridgeLegOut
    leg_b: ChatPhoneBridgeLegOut
    error_hint: str | None = None


class ChatMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    body_i18n: dict[str, str] | None = None


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    sender_role: str
    sender_display_name: str = ""
    body: str
    read_at: datetime | None = None
    created_at: datetime


class ChatInvoiceLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    minutes: int
    amount: str
    currency: str
    status: str
    transaction_id: str | None
    created_at: datetime


class ChatInvoiceSummaryOut(BaseModel):
    """List row for a completed chat invoice."""

    session_id: str
    invoice_number: str
    mentor_name: str
    customer_display_name: str | None = None
    total_amount: str
    currency: str
    total_minutes_purchased: int
    payment_status: str
    session_started_at: datetime
    session_ended_at: datetime
    issued_at: datetime


class ChatInvoiceConversationLineOut(BaseModel):
    """One stored chat message on an invoice (user and mentor sides)."""

    id: str
    sender_role: str
    sender_display_name: str
    body: str
    created_at: datetime


class ChatInvoiceDetailOut(BaseModel):
    """Full invoice for print / detail view."""

    invoice_number: str
    issued_at: datetime
    payment_status: str
    session_id: str
    session_status: str
    session_started_at: datetime
    session_ended_at: datetime
    session_duration_seconds: int
    total_minutes_purchased: int
    total_amount: str
    currency: str
    bill_to_name: str
    bill_to_email: str
    bill_to_phone: str | None
    service_provider_name: str
    service_provider_email: str
    line_items: list[ChatInvoiceLineOut]
    conversation: list[ChatInvoiceConversationLineOut]


class ChatInboxSessionOut(ChatSessionOut):
    partner_name: str
    partner_profile_image: str | None = None
    last_message_body: str | None = None
    last_message_role: str | None = None


class ChatInboxOut(BaseModel):
    sessions: list[ChatInboxSessionOut]
