from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from typing import Literal
from sqlalchemy import func, update
from sqlalchemy.exc import OperationalError

from api.deps import CurrentMentor, DbSession, RequestLang
from core.booking_states import PAYMENT_RECORD_SUCCEEDED
from core.config import settings
from core.security import new_uuid
from models.availability_slot import AvailabilitySlot
from models.booking import Booking
from models.mentor import Mentor
from models.mentor_monthly_invoice import MentorMonthlyInvoice
from models.mentor_payout_account import MentorPayoutAccount
from models.mentor_onboarding_payment import MentorOnboardingPayment
from models.mentor_settlement import MentorSettlement, MentorSettlementItem
from models.payment import Payment
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from schemas.mentor import (
    CoachAgreementAcceptIn,
    MentorAccountOut,
    MentorPayoutBankDetailsIn,
    MentorPayoutBankDetailsOut,
    MentorUpdate,
)
from schemas.platform_invoice import MentorMonthlyFeeStatementOut, MentorOnboardingInvoiceOut
from schemas.slot import SlotCreate, SlotOut, SlotUpdate
from services.fx_checkout import FxCheckoutError, FxUpstreamError
from services.invoice_service import InvoiceError
from services.mentor_monthly_fee_service import ensure_monthly_invoice_mollie_checkout
from services.mentor_monthly_invoice_pdf import build_mentor_monthly_invoice_pdf
from services.settlement_invoice_pdf import build_settlement_invoice_pdf, settlement_invoice_number
from services.platform_invoice_service import load_mentor_monthly_statement, load_mentor_onboarding_invoice
from services.payout_bank_service import mask_bic, mask_iban, normalize_bic, validate_and_normalize_iban
from services.mollie_service import MollieServiceError, resolve_mollie_webhook_url
from services.mentor_card_visibility import normalize_card_visibility
from services.onboarding_payment_service import create_onboarding_checkout, mentor_onboarding_status
from services.i18n_service import resolve_i18n_text, to_i18n_map
from services.booking_slot_service import SLOT_BLOCKING_STATUSES
from core.coach_agreement import COACH_AGREEMENT_TEXT, COACH_AGREEMENT_VERSION
from services.presence_service import presence_service
from services.mentor_presence_tracking_service import accrue_mentor_presence
from services.ledger_service import (
    ACCOUNT_COACH_PENDING,
    ACCOUNT_COACH_WITHDRAWABLE,
    OWNER_COACH,
    get_account_balance,
    get_or_create_wallet_account,
)
from services.pricing_service import effective_chat_price_per_minute_eur
from services.timezone_service import TimezoneConversionError, date_time_to_utc, local_datetime_to_utc, validate_timezone_name

class EarningsSummary(BaseModel):
    total_amount: Decimal
    payment_count: int
    currency: str = "EUR"


class MentorMonthlyInvoiceOut(BaseModel):
    id: str
    invoice_month: str
    gross_revenue: Decimal
    fee_percent: Decimal
    fee_amount: Decimal
    currency: str
    status: str
    mollie_checkout_url: str | None
    paid_at: datetime | None
    reminder_sent_at: datetime | None
    created_at: datetime


class MentorSettlementOut(BaseModel):
    id: str
    currency: str
    cycle_start: str
    cycle_end: str
    gross_amount: str
    fee_amount: str
    net_amount: str
    status: str
    provider_batch_ref: str | None
    paid_at: datetime | None
    created_at: datetime
    invoice_number: str


class MentorOnboardingPaymentOut(BaseModel):
    id: str
    amount: Decimal
    currency: str
    status: str
    mollie_payment_id: str
    checkout_url: str | None
    payment_plan: str
    installment_number: int
    installment_total: int
    paid_at: datetime | None
    created_at: datetime
    updated_at: datetime


class MentorOnboardingStatusOut(BaseModel):
    is_complete: bool
    payment_plan: str | None
    installments_paid: int
    installment_total: int
    next_installment_number: int | None
    next_amount_eur: str | None


class MentorOnboardingCheckoutIn(BaseModel):
    checkout_currency: str = "EUR"
    payment_plan: Literal["full", "installments"] = "full"
    installment_number: int = Field(default=1, ge=1, le=2)
    promo_code: str | None = None


class MentorOnboardingCheckoutOut(BaseModel):
    payment_id: str
    checkout_url: str
    amount: str
    currency: str
    payment_plan: str
    installment_number: int
    installment_total: int


class MonthlyInvoicePrepareCheckoutIn(BaseModel):
    checkout_currency: str = "EUR"


class DateAmountPoint(BaseModel):
    date: str
    amount: str


class MentorEarningsSeriesOut(BaseModel):
    period: str
    range_start: datetime
    range_end: datetime
    bookings_by_day: list[DateAmountPoint]
    chat_by_day: list[DateAmountPoint]


router = APIRouter(prefix="/mentors/me", tags=["mentor-self"])


def _is_mysql_lock_wait_timeout(exc: OperationalError) -> bool:
    orig = getattr(exc, "orig", None)
    code = getattr(orig, "args", (None,))[0] if orig is not None else None
    return code == 1205


@router.get("", response_model=MentorAccountOut)
def mentor_profile(me: CurrentMentor, lang: RequestLang) -> MentorAccountOut:
    out = MentorAccountOut.model_validate(me).model_dump()
    out["headline"] = resolve_i18n_text(getattr(me, "headline_i18n", None), me.headline, lang)
    out["bio"] = resolve_i18n_text(getattr(me, "bio_i18n", None), me.bio, lang)
    out["chat_price_per_minute"] = effective_chat_price_per_minute_eur(me)
    out["public_card_visibility"] = normalize_card_visibility(getattr(me, "public_card_visibility", None))
    return MentorAccountOut.model_validate(out)


@router.post("/presence", status_code=status.HTTP_204_NO_CONTENT)
def mentor_presence_heartbeat(db: DbSession, me: CurrentMentor) -> Response:
    """Mark mentor online when dashboard/app is open and accrue weekly platform time."""
    presence_service.set_online(me.id, "mentor")
    now = datetime.now(timezone.utc)
    try:
        # Reload for accrual fields; CurrentMentor may be detached/stale across workers.
        mentor = db.query(Mentor).filter(Mentor.id == me.id).first()
        if mentor:
            accrue_mentor_presence(db, mentor, now=now)
            db.commit()
        else:
            db.execute(update(Mentor).where(Mentor.id == me.id).values(last_seen_at=now))
            db.commit()
    except OperationalError as e:
        db.rollback()
        if not _is_mysql_lock_wait_timeout(e):
            raise
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class MentorPresenceStatusOut(BaseModel):
    is_online: bool
    chat_busy: bool
    status: str


@router.get("/presence-status", response_model=MentorPresenceStatusOut)
def mentor_presence_status(db: DbSession, me: CurrentMentor) -> MentorPresenceStatusOut:
    from services.chat_service import mentor_chat_busy

    online = presence_service.is_online(me.id, "mentor")
    busy = mentor_chat_busy(db, me.id)
    if busy:
        status_label = "busy"
    elif online:
        status_label = "online"
    else:
        status_label = "offline"
    return MentorPresenceStatusOut(is_online=online, chat_busy=busy, status=status_label)


@router.patch("", response_model=MentorAccountOut)
def mentor_update(db: DbSession, me: CurrentMentor, payload: MentorUpdate, lang: RequestLang) -> MentorAccountOut:
    data = payload.model_dump(exclude_unset=True)
    if "timezone" in data and data["timezone"] is not None:
        try:
            data["timezone"] = validate_timezone_name(data["timezone"])
        except TimezoneConversionError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    if "country_code" in data and data["country_code"] is not None:
        data["country_code"] = data["country_code"].strip().upper()[:2] or None
    if "headline" in data and "headline_i18n" not in data:
        data["headline_i18n"] = to_i18n_map(data["headline"])
    if "bio" in data and "bio_i18n" not in data:
        data["bio_i18n"] = to_i18n_map(data["bio"])
    if "public_card_visibility" in data and data["public_card_visibility"] is not None:
        raw = data["public_card_visibility"]
        if hasattr(raw, "model_dump"):
            raw = raw.model_dump()
        data["public_card_visibility"] = normalize_card_visibility(raw)
    for k, v in data.items():
        setattr(me, k, v)
    me.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(me)
    out = MentorAccountOut.model_validate(me).model_dump()
    out["headline"] = resolve_i18n_text(getattr(me, "headline_i18n", None), me.headline, lang)
    out["bio"] = resolve_i18n_text(getattr(me, "bio_i18n", None), me.bio, lang)
    out["chat_price_per_minute"] = effective_chat_price_per_minute_eur(me)
    out["public_card_visibility"] = normalize_card_visibility(getattr(me, "public_card_visibility", None))
    return MentorAccountOut.model_validate(out)


@router.post("/coach-agreement", response_model=MentorAccountOut)
def accept_coach_agreement(
    db: DbSession,
    me: CurrentMentor,
    payload: CoachAgreementAcceptIn,
    lang: RequestLang,
) -> MentorAccountOut:
    if payload.agreement_version != COACH_AGREEMENT_VERSION:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Coach agreement version mismatch")
    if payload.agreement_text_snapshot.strip() != COACH_AGREEMENT_TEXT.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Coach agreement text mismatch")

    now = datetime.now(timezone.utc)
    me.agreement_accepted_at = now
    me.agreement_version = COACH_AGREEMENT_VERSION
    me.agreement_text_snapshot = COACH_AGREEMENT_TEXT
    me.agreement_text_snapshot_i18n = to_i18n_map(COACH_AGREEMENT_TEXT)
    me.updated_at = now
    db.commit()
    db.refresh(me)

    out = MentorAccountOut.model_validate(me).model_dump()
    out["headline"] = resolve_i18n_text(getattr(me, "headline_i18n", None), me.headline, lang)
    out["bio"] = resolve_i18n_text(getattr(me, "bio_i18n", None), me.bio, lang)
    out["chat_price_per_minute"] = effective_chat_price_per_minute_eur(me)
    out["public_card_visibility"] = normalize_card_visibility(getattr(me, "public_card_visibility", None))
    return MentorAccountOut.model_validate(out)


@router.get("/slots", response_model=list[SlotOut])
def list_my_slots(db: DbSession, me: CurrentMentor) -> list[AvailabilitySlot]:
    rows = (
        db.query(AvailabilitySlot)
        .filter(
            AvailabilitySlot.mentor_id == me.id,
            ~db.query(Booking.id)
            .filter(
                Booking.slot_id == AvailabilitySlot.id,
                Booking.status.in_(SLOT_BLOCKING_STATUSES),
            )
            .exists(),
        )
        .order_by(AvailabilitySlot.start_at_utc)
        .all()
    )
    for row in rows:
        if row.start_at_utc is None:
            row.start_at_utc = datetime.combine(row.slot_date, row.start_time).replace(tzinfo=timezone.utc)
        if row.end_at_utc is None:
            row.end_at_utc = datetime.combine(row.slot_date, row.end_time).replace(tzinfo=timezone.utc)
    return rows


@router.post("/slots", response_model=SlotOut, status_code=status.HTTP_201_CREATED)
def create_slot(db: DbSession, me: CurrentMentor, payload: SlotCreate) -> AvailabilitySlot:
    now = datetime.now(timezone.utc)
    tz_name = payload.timezone or me.timezone or "UTC"
    try:
        tz_name = validate_timezone_name(tz_name)
    except TimezoneConversionError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    if payload.start_local and payload.end_local:
        start_at_utc = local_datetime_to_utc(payload.start_local, tz_name)
        end_at_utc = local_datetime_to_utc(payload.end_local, tz_name)
        slot_date = start_at_utc.date()
        start_time = start_at_utc.time().replace(tzinfo=None)
        end_time = end_at_utc.time().replace(tzinfo=None)
    elif payload.slot_date and payload.start_time and payload.end_time:
        start_at_utc = date_time_to_utc(payload.slot_date, payload.start_time, tz_name)
        end_at_utc = date_time_to_utc(payload.slot_date, payload.end_time, tz_name)
        slot_date = start_at_utc.date()
        start_time = start_at_utc.time().replace(tzinfo=None)
        end_time = end_at_utc.time().replace(tzinfo=None)
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Provide either start_local/end_local or slot_date/start_time/end_time",
        )

    if end_at_utc <= start_at_utc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Slot end must be after slot start")

    slot = AvailabilitySlot(
        id=new_uuid(),
        mentor_id=me.id,
        slot_date=slot_date,
        start_time=start_time,
        end_time=end_time,
        start_at_utc=start_at_utc,
        end_at_utc=end_at_utc,
        slot_duration=payload.slot_duration,
        is_booked=False,
        is_recurring=payload.is_recurring,
        created_at=now,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.patch("/slots/{slot_id}", response_model=SlotOut)
def update_slot(
    slot_id: str,
    db: DbSession,
    me: CurrentMentor,
    payload: SlotUpdate,
) -> AvailabilitySlot:
    slot = (
        db.query(AvailabilitySlot)
        .filter(AvailabilitySlot.id == slot_id, AvailabilitySlot.mentor_id == me.id)
        .first()
    )
    if not slot:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found")
    if slot.is_booked:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot edit a booked slot")
    data = payload.model_dump(exclude_unset=True)
    tz_name = data.get("timezone") or me.timezone or "UTC"
    if "timezone" in data and data["timezone"] is not None:
        try:
            tz_name = validate_timezone_name(data["timezone"])
        except TimezoneConversionError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    data.pop("timezone", None)

    if data.get("start_local") and data.get("end_local"):
        start_at_utc = local_datetime_to_utc(data["start_local"], tz_name)
        end_at_utc = local_datetime_to_utc(data["end_local"], tz_name)
        data["start_at_utc"] = start_at_utc
        data["end_at_utc"] = end_at_utc
        data["slot_date"] = start_at_utc.date()
        data["start_time"] = start_at_utc.time().replace(tzinfo=None)
        data["end_time"] = end_at_utc.time().replace(tzinfo=None)
    elif data.get("slot_date") and data.get("start_time") and data.get("end_time"):
        start_at_utc = date_time_to_utc(data["slot_date"], data["start_time"], tz_name)
        end_at_utc = date_time_to_utc(data["slot_date"], data["end_time"], tz_name)
        data["start_at_utc"] = start_at_utc
        data["end_at_utc"] = end_at_utc
        data["slot_date"] = start_at_utc.date()
        data["start_time"] = start_at_utc.time().replace(tzinfo=None)
        data["end_time"] = end_at_utc.time().replace(tzinfo=None)
    data.pop("start_local", None)
    data.pop("end_local", None)
    for k, v in data.items():
        setattr(slot, k, v)
    db.commit()
    db.refresh(slot)
    return slot


@router.get("/earnings", response_model=EarningsSummary)
def mentor_earnings(db: DbSession, me: CurrentMentor) -> EarningsSummary:
    pending = get_or_create_wallet_account(
        db,
        owner_type=OWNER_COACH,
        owner_id=me.id,
        account_kind=ACCOUNT_COACH_PENDING,
        currency="EUR",
    )
    withdrawable = get_or_create_wallet_account(
        db,
        owner_type=OWNER_COACH,
        owner_id=me.id,
        account_kind=ACCOUNT_COACH_WITHDRAWABLE,
        currency="EUR",
    )
    # Keep dashboard earnings consistent with payout wallet balances.
    total = get_account_balance(db, pending.id) + get_account_balance(db, withdrawable.id)
    return EarningsSummary(total_amount=total, payment_count=0)


def _period_bounds(period: str) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    if period == "day":
        start = end - timedelta(days=1)
    elif period == "week":
        start = end - timedelta(days=7)
    elif period == "month":
        start = end - timedelta(days=30)
    elif period == "year":
        start = end - timedelta(days=365)
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid period")
    return start, end


@router.get("/earnings-series", response_model=MentorEarningsSeriesOut)
def mentor_earnings_series(
    db: DbSession,
    me: CurrentMentor,
    period: str = Query("month"),
) -> MentorEarningsSeriesOut:
    start, end = _period_bounds(period)

    day = func.date(Payment.created_at)
    eur_amt = func.coalesce(Payment.amount_base_eur, Payment.amount)
    booking_rows = (
        db.query(day, func.coalesce(func.sum(eur_amt), 0))
        .join(Booking, Payment.booking_id == Booking.id)
        .filter(Booking.mentor_id == me.id)
        .filter(Payment.created_at >= start, Payment.created_at <= end)
        .filter(Payment.status == PAYMENT_RECORD_SUCCEEDED)
        .group_by(day)
        .order_by(day)
        .all()
    )
    bookings_by_day = [
        DateAmountPoint(date=(d.isoformat() if hasattr(d, "isoformat") else str(d)), amount=str(amt))
        for d, amt in booking_rows
        if d is not None
    ]

    chat_day = func.date(ChatPurchase.created_at)
    chat_eur = func.coalesce(ChatPurchase.amount_base_eur, ChatPurchase.amount)
    chat_rows = (
        db.query(chat_day, func.coalesce(func.sum(chat_eur), 0))
        .join(ChatSession, ChatPurchase.session_id == ChatSession.id)
        .filter(ChatSession.mentor_id == me.id)
        .filter(ChatPurchase.created_at >= start, ChatPurchase.created_at <= end)
        .filter(ChatPurchase.status.in_(["succeeded", "paid", "completed"]))
        .group_by(chat_day)
        .order_by(chat_day)
        .all()
    )
    chat_by_day = [
        DateAmountPoint(date=(d.isoformat() if hasattr(d, "isoformat") else str(d)), amount=str(amt))
        for d, amt in chat_rows
        if d is not None
    ]

    return MentorEarningsSeriesOut(
        period=period,
        range_start=start,
        range_end=end,
        bookings_by_day=bookings_by_day,
        chat_by_day=chat_by_day,
    )


@router.get("/monthly-invoices", response_model=list[MentorMonthlyInvoiceOut])
def mentor_monthly_invoices(db: DbSession, me: CurrentMentor) -> list[MentorMonthlyInvoiceOut]:
    rows = (
        db.query(MentorMonthlyInvoice)
        .filter(MentorMonthlyInvoice.mentor_id == me.id)
        .order_by(MentorMonthlyInvoice.invoice_month.desc())
        .all()
    )
    return [
        MentorMonthlyInvoiceOut(
            id=r.id,
            invoice_month=r.invoice_month.isoformat(),
            gross_revenue=Decimal(str(r.gross_revenue)),
            fee_percent=Decimal(str(r.fee_percent)),
            fee_amount=Decimal(str(r.fee_amount)),
            currency=r.currency,
            status=r.status,
            mollie_checkout_url=r.mollie_checkout_url,
            paid_at=r.paid_at,
            reminder_sent_at=r.reminder_sent_at,
            created_at=r.created_at,
        )
        for r in rows
    ]


def _mentor_settlement_out(s: MentorSettlement) -> MentorSettlementOut:
    return MentorSettlementOut(
        id=s.id,
        currency=s.currency,
        cycle_start=s.cycle_start.isoformat(),
        cycle_end=s.cycle_end.isoformat(),
        gross_amount=str(Decimal(str(s.gross_amount)).quantize(Decimal("0.01"))),
        fee_amount=str(Decimal(str(s.fee_amount)).quantize(Decimal("0.01"))),
        net_amount=str(Decimal(str(s.net_amount)).quantize(Decimal("0.01"))),
        status=s.status,
        provider_batch_ref=s.provider_batch_ref,
        paid_at=s.paid_at,
        created_at=s.created_at,
        invoice_number=settlement_invoice_number(s),
    )


@router.get("/settlements", response_model=list[MentorSettlementOut])
def mentor_list_settlements(db: DbSession, me: CurrentMentor) -> list[MentorSettlementOut]:
    rows = (
        db.query(MentorSettlement)
        .filter(MentorSettlement.mentor_id == me.id)
        .order_by(MentorSettlement.created_at.desc())
        .all()
    )
    return [_mentor_settlement_out(r) for r in rows]


@router.get("/settlements/{settlement_id}/pdf")
def mentor_settlement_invoice_pdf(settlement_id: str, db: DbSession, me: CurrentMentor) -> Response:
    s = (
        db.query(MentorSettlement)
        .filter(MentorSettlement.id == settlement_id, MentorSettlement.mentor_id == me.id)
        .first()
    )
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Settlement not found")
    items = (
        db.query(MentorSettlementItem)
        .filter(MentorSettlementItem.settlement_id == settlement_id)
        .order_by(MentorSettlementItem.created_at.asc())
        .all()
    )
    pdf_bytes = build_settlement_invoice_pdf(settlement=s, mentor=me, items=items)
    inv_no = settlement_invoice_number(s)
    safe_name = f"settlement-invoice-{inv_no}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/monthly-invoices/{invoice_id}", response_model=MentorMonthlyFeeStatementOut)
def mentor_monthly_invoice_detail(invoice_id: str, db: DbSession, me: CurrentMentor) -> MentorMonthlyFeeStatementOut:
    try:
        return load_mentor_monthly_statement(db, invoice_id=invoice_id, mentor_id=me.id)
    except InvoiceError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.get("/monthly-invoices/{invoice_id}/pdf")
def mentor_monthly_invoice_pdf(invoice_id: str, db: DbSession, me: CurrentMentor) -> Response:
    inv = (
        db.query(MentorMonthlyInvoice)
        .filter(MentorMonthlyInvoice.id == invoice_id, MentorMonthlyInvoice.mentor_id == me.id)
        .first()
    )
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    pdf_bytes = build_mentor_monthly_invoice_pdf(invoice=inv, mentor=me)
    safe_name = f"coach-monthly-invoice-{str(inv.invoice_month)}-{inv.id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/onboarding-status", response_model=MentorOnboardingStatusOut)
def mentor_onboarding_payment_status(db: DbSession, me: CurrentMentor) -> MentorOnboardingStatusOut:
    return MentorOnboardingStatusOut.model_validate(mentor_onboarding_status(db, me.id))


@router.post("/onboarding-payment", response_model=MentorOnboardingCheckoutOut)
def mentor_create_onboarding_payment(
    request: Request,
    db: DbSession,
    me: CurrentMentor,
    payload: MentorOnboardingCheckoutIn,
) -> MentorOnboardingCheckoutOut:
    redirect_url = f"{settings.mollie_redirect_base_url.rstrip('/')}/mentor"
    row = create_onboarding_checkout(
        db,
        mentor=me,
        payment_plan=payload.payment_plan,
        installment_number=payload.installment_number,
        checkout_currency=payload.checkout_currency,
        redirect_url=redirect_url,
        webhook_url=resolve_mollie_webhook_url(request),
        promo_code=payload.promo_code,
    )
    db.commit()
    return MentorOnboardingCheckoutOut(
        payment_id=row.mollie_payment_id,
        checkout_url=row.checkout_url or "",
        amount=str(row.amount),
        currency=row.currency,
        payment_plan=row.payment_plan,
        installment_number=row.installment_number,
        installment_total=row.installment_total,
    )


@router.get("/onboarding-payments", response_model=list[MentorOnboardingPaymentOut])
def mentor_onboarding_payments(db: DbSession, me: CurrentMentor) -> list[MentorOnboardingPaymentOut]:
    rows = (
        db.query(MentorOnboardingPayment)
        .filter(MentorOnboardingPayment.mentor_id == me.id)
        .order_by(MentorOnboardingPayment.created_at.desc())
        .all()
    )
    return [
        MentorOnboardingPaymentOut(
            id=r.id,
            amount=Decimal(str(r.amount)),
            currency=r.currency,
            status=r.status,
            mollie_payment_id=r.mollie_payment_id,
            checkout_url=r.checkout_url,
            payment_plan=getattr(r, "payment_plan", None) or "full",
            installment_number=int(getattr(r, "installment_number", None) or 1),
            installment_total=int(getattr(r, "installment_total", None) or 1),
            paid_at=r.paid_at,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.get("/onboarding-payments/{payment_id}/invoice", response_model=MentorOnboardingInvoiceOut)
def mentor_onboarding_payment_invoice(payment_id: str, db: DbSession, me: CurrentMentor) -> MentorOnboardingInvoiceOut:
    try:
        return load_mentor_onboarding_invoice(db, payment_id=payment_id, mentor_id=me.id)
    except InvoiceError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.post("/monthly-invoices/{invoice_id}/prepare-checkout", response_model=MentorMonthlyInvoiceOut)
def mentor_prepare_monthly_invoice_checkout(
    invoice_id: str,
    db: DbSession,
    me: CurrentMentor,
    request: Request,
    payload: MonthlyInvoicePrepareCheckoutIn,
) -> MentorMonthlyInvoiceOut:
    inv = (
        db.query(MentorMonthlyInvoice)
        .filter(MentorMonthlyInvoice.id == invoice_id, MentorMonthlyInvoice.mentor_id == me.id)
        .with_for_update()
        .first()
    )
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    if inv.status == "paid":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invoice already paid")

    ccy = payload.checkout_currency.strip()
    try:
        ensure_monthly_invoice_mollie_checkout(
            db,
            invoice=inv,
            mentor=me,
            checkout_currency=ccy,
            webhook_url=resolve_mollie_webhook_url(request),
            force_new=False,
        )
    except FxCheckoutError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except FxUpstreamError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
    except MollieServiceError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    db.commit()
    db.refresh(inv)
    return MentorMonthlyInvoiceOut(
        id=inv.id,
        invoice_month=inv.invoice_month.isoformat(),
        gross_revenue=Decimal(str(inv.gross_revenue)),
        fee_percent=Decimal(str(inv.fee_percent)),
        fee_amount=Decimal(str(inv.fee_amount)),
        currency=inv.currency,
        status=inv.status,
        mollie_checkout_url=inv.mollie_checkout_url,
        paid_at=inv.paid_at,
        reminder_sent_at=inv.reminder_sent_at,
        created_at=inv.created_at,
    )


@router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_slot(slot_id: str, db: DbSession, me: CurrentMentor) -> None:
    slot = (
        db.query(AvailabilitySlot)
        .filter(AvailabilitySlot.id == slot_id, AvailabilitySlot.mentor_id == me.id)
        .first()
    )
    if not slot:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found")
    if slot.is_booked:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete a booked slot")
    db.delete(slot)
    db.commit()


@router.get("/payout-bank-details", response_model=MentorPayoutBankDetailsOut)
def mentor_get_payout_bank_details(db: DbSession, me: CurrentMentor) -> MentorPayoutBankDetailsOut:
    row = db.query(MentorPayoutAccount).filter(MentorPayoutAccount.mentor_id == me.id).first()
    if not row or not row.iban:
        base_status = row.status if row else "none"
        return MentorPayoutBankDetailsOut(has_bank_details=False, status="none" if not row else base_status)
    return MentorPayoutBankDetailsOut(
        has_bank_details=True,
        account_holder_name=row.account_holder_name,
        iban_masked=mask_iban(row.iban),
        bic_masked=mask_bic(row.bic),
        status=row.status,
        verified_at=row.verified_at,
        updated_at=row.updated_at,
    )


@router.put("/payout-bank-details", response_model=MentorPayoutBankDetailsOut)
def mentor_save_payout_bank_details(
    db: DbSession, me: CurrentMentor, payload: MentorPayoutBankDetailsIn
) -> MentorPayoutBankDetailsOut:
    try:
        iban = validate_and_normalize_iban(payload.iban)
        bic = normalize_bic(payload.bic)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    holder = payload.account_holder_name.strip()
    if len(holder) < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Account holder name is too short.")

    mask = mask_iban(iban)
    now = datetime.now(timezone.utc)
    row = db.query(MentorPayoutAccount).filter(MentorPayoutAccount.mentor_id == me.id).first()
    if not row:
        row = MentorPayoutAccount(
            id=new_uuid(),
            mentor_id=me.id,
            provider_name="platform_manual_transfer",
            provider_account_ref=f"iban:{mask}",
            account_holder_name=holder,
            iban=iban,
            bic=bic,
            status="submitted",
            verified_at=None,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
    else:
        row.account_holder_name = holder
        row.iban = iban
        row.bic = bic
        row.provider_name = "platform_manual_transfer"
        row.provider_account_ref = f"iban:{mask}"
        row.status = "submitted"
        row.verified_at = None
        row.updated_at = now

    db.commit()
    db.refresh(row)
    return MentorPayoutBankDetailsOut(
        has_bank_details=True,
        account_holder_name=row.account_holder_name,
        iban_masked=mask_iban(row.iban or ""),
        bic_masked=mask_bic(row.bic),
        status=row.status,
        verified_at=row.verified_at,
        updated_at=row.updated_at,
    )
