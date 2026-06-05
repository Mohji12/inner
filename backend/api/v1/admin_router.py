from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from api.deps import CurrentAdmin, DbSession, RequestLang
from core.chat_states import CHAT_SENDER_USER
from models.booking import Booking
from models.chat_message import ChatMessage
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.coach_application import CoachApplication
from models.mentor import Mentor
from models.mentor_onboarding_payment import MentorOnboardingPayment
from models.mentor_payout_account import MentorPayoutAccount
from models.mentor_settlement import MentorSettlement, MentorSettlementItem
from models.payment import Payment
from models.platform_pricing import PlatformPricing
from models.review import Review
from models.user import User
from models.wallet import Wallet, WalletTransaction
from schemas.chat import ChatInvoiceConversationLineOut, ChatInvoiceDetailOut, ChatInvoiceLineOut, ChatInvoiceSummaryOut
from schemas.admin import (
    AdminBookingInvoiceList,
    AdminBookingInvoiceRow,
    AdminBookingList,
    AdminBookingRow,
    AdminOnboardingInvoiceList,
    AdminOnboardingInvoiceRow,
    AdminTransactionList,
    AdminTransactionRow,
    AdminMentorList,
    AdminMentorMonthlyInvoiceList,
    AdminMentorMonthlyInvoiceRow,
    AdminMentorBankDetailsPrivateOut,
    AdminMentorPayoutAccountOut,
    AdminMentorPayoutAccountUpsertRequest,
    AdminPlatformPricingOut,
    AdminPlatformPricingUpdateRequest,
    AdminMentorRow,
    AdminPaymentList,
    AdminPaymentRow,
    AdminSettlementCandidateList,
    AdminSettlementCandidateRow,
    AdminSettlementDetail,
    AdminSettlementGenerateRequest,
    AdminSettlementItemRow,
    AdminSettlementList,
    AdminSettlementPayRequest,
    AdminSettlementRow,
    AdminWalletAdjustRequest,
    AdminWalletAnalyticsResponse,
    AdminWalletUserAnalyticsRow,
    AdminWalletAdjustResponse,
    AdminReviewList,
    AdminReviewRow,
    AdminUserList,
    AdminUserRow,
    AnalyticsResponse,
    AnalyticsSummary,
    DateAmountPoint,
    DateCountPoint,
    MentorApprovalUpdateRequest,
)
from services.booking_invoice_pdf import build_booking_invoice_pdf_from_out
from services.invoice_errors import InvoiceError
from services.platform_invoice_service import (
    list_admin_booking_invoices,
    list_admin_onboarding_invoices,
    load_booking_invoice,
    load_mentor_onboarding_invoice,
)
from services.chat_invoice_service import aggregate_purchases
from services.mentor_monthly_invoice_pdf import build_mentor_monthly_invoice_pdf
from services.payout_gateway import payout_gateway
from services.marketplace_service import MarketplaceError, connect_payout_gate_status, resolve_connect_access_token_for_payout
from services.settlement_service import (
    SettlementError,
    approve_settlement,
    compute_candidates,
    generate_settlements,
    settlement_cycle_bounds,
)
from services.wallet_service import WalletError, credit_wallet, debit_wallet, get_or_create_wallet
from core.security import new_uuid
from services.fx_checkout import FxCheckoutError, FxUpstreamError
from services.mentor_monthly_fee_service import (
    create_or_refresh_monthly_invoice,
    ensure_monthly_invoice_mollie_checkout,
)
from services.mollie_service import MollieServiceError, resolve_mollie_webhook_url
from services.pricing_service import get_platform_pricing
from services.i18n_service import resolve_i18n_text
from schemas.coach_application import (
    AdminCoachApplicationList,
    AdminCoachApplicationRow,
    AdminCoachApplicationUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])

Period = Literal["day", "week", "month", "year"]

def _period_bounds(period: Period) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    if period == "day":
        start = end - timedelta(days=1)
    elif period == "week":
        start = end - timedelta(days=7)
    elif period == "month":
        start = end - timedelta(days=30)
    else:
        start = end - timedelta(days=365)
    return start, end


def _invoice_number(session_id: str) -> str:
    return f"CHAT-{session_id[:8].upper()}"


def _session_wall_duration_seconds(session: ChatSession) -> int:
    ca = session.created_at
    ua = session.updated_at
    if ca.tzinfo is None:
        ca = ca.replace(tzinfo=timezone.utc)
    if ua.tzinfo is None:
        ua = ua.replace(tzinfo=timezone.utc)
    return max(0, int((ua - ca).total_seconds()))


def _in_range(model, start: datetime, end: datetime):
    return (model.created_at >= start) & (model.created_at <= end)


def _platform_pricing_out(row: PlatformPricing) -> AdminPlatformPricingOut:
    return AdminPlatformPricingOut(
        id=row.id,
        price_5_min=Decimal(str(row.price_5_min)),
        price_10_min=Decimal(str(row.price_10_min)),
        price_20_min=Decimal(str(row.price_20_min)),
        price_30_min=Decimal(str(row.price_30_min)),
        currency=row.currency,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _settlement_row(db: DbSession, s: MentorSettlement) -> AdminSettlementRow:
    mentor = db.query(Mentor).filter(Mentor.id == s.mentor_id).first()
    payout_ready, payout_blocked = connect_payout_gate_status(db, s.mentor_id)
    return AdminSettlementRow(
        id=s.id,
        mentor_id=s.mentor_id,
        mentor_name=mentor.full_name if mentor else s.mentor_id,
        currency=s.currency,
        cycle_start=s.cycle_start,
        cycle_end=s.cycle_end,
        gross_amount=str(Decimal(str(s.gross_amount)).quantize(Decimal("0.01"))),
        fee_amount=str(Decimal(str(s.fee_amount)).quantize(Decimal("0.01"))),
        net_amount=str(Decimal(str(s.net_amount)).quantize(Decimal("0.01"))),
        status=s.status,
        provider_batch_ref=s.provider_batch_ref,
        failure_reason=s.failure_reason,
        paid_at=s.paid_at,
        created_at=s.created_at,
        connect_payout_ready=payout_ready,
        connect_payout_blocked_reason=payout_blocked,
    )


@router.get("/users", response_model=AdminUserList)
def admin_list_users(
    db: DbSession,
    _admin: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None, description="Search email or full name"),
) -> AdminUserList:
    query = db.query(User)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter((User.email.like(term)) | (User.full_name.like(term)))
    total = query.count()
    rows = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    items = [
        AdminUserRow(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            phone_number=u.phone_number,
            account_status=u.account_status,
            email_verified=u.email_verified,
            created_at=u.created_at,
        )
        for u in rows
    ]
    return AdminUserList(items=items, total=total, skip=skip, limit=limit)


@router.get("/mentors", response_model=AdminMentorList)
def admin_list_mentors(
    db: DbSession,
    _admin: CurrentAdmin,
    lang: RequestLang,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None),
) -> AdminMentorList:
    query = db.query(Mentor)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter((Mentor.email.like(term)) | (Mentor.full_name.like(term)))
    total = query.count()
    rows = query.order_by(Mentor.created_at.desc()).offset(skip).limit(limit).all()
    items = [
        AdminMentorRow(
            id=m.id,
            full_name=m.full_name,
            email=m.email,
            phone_number=m.phone_number,
            headline=resolve_i18n_text(getattr(m, "headline_i18n", None), m.headline, lang),
            status=m.status,
            is_approved=m.is_approved,
            email_verified=m.email_verified,
            created_at=m.created_at,
        )
        for m in rows
    ]
    return AdminMentorList(items=items, total=total, skip=skip, limit=limit)


@router.patch("/mentors/{mentor_id}/approval", response_model=AdminMentorRow)
def admin_update_mentor_approval(
    mentor_id: str,
    payload: MentorApprovalUpdateRequest,
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminMentorRow:
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")

    if payload.action == "approve":
        mentor.is_approved = True
        mentor.status = "active"
    else:
        mentor.is_approved = False
        mentor.status = "rejected"

    db.commit()
    db.refresh(mentor)
    return AdminMentorRow.model_validate(mentor)


@router.get("/coach-applications", response_model=AdminCoachApplicationList)
def admin_list_coach_applications(
    db: DbSession,
    _admin: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None, description="Search name, email, or headline"),
    status: str | None = Query(None, description="Filter by status"),
) -> AdminCoachApplicationList:
    query = db.query(CoachApplication)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            (CoachApplication.full_name.like(term))
            | (CoachApplication.email.like(term))
            | (CoachApplication.headline.like(term))
        )
    if status and status.strip():
        query = query.filter(CoachApplication.status == status.strip().lower())
    total = query.count()
    rows = query.order_by(CoachApplication.created_at.desc()).offset(skip).limit(limit).all()
    items = [AdminCoachApplicationRow.model_validate(r) for r in rows]
    return AdminCoachApplicationList(items=items, total=total, skip=skip, limit=limit)


@router.patch("/coach-applications/{application_id}", response_model=AdminCoachApplicationRow)
def admin_update_coach_application(
    application_id: str,
    payload: AdminCoachApplicationUpdate,
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminCoachApplicationRow:
    row = db.query(CoachApplication).filter(CoachApplication.id == application_id).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if payload.status is not None:
        row.status = payload.status
    if payload.admin_notes is not None:
        row.admin_notes = payload.admin_notes.strip() or None
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return AdminCoachApplicationRow.model_validate(row)


@router.get("/platform-pricing", response_model=AdminPlatformPricingOut)
def admin_get_platform_pricing(
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminPlatformPricingOut:
    return _platform_pricing_out(get_platform_pricing(db))


@router.put("/platform-pricing", response_model=AdminPlatformPricingOut)
def admin_update_platform_pricing(
    payload: AdminPlatformPricingUpdateRequest,
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminPlatformPricingOut:
    for value in (payload.price_5_min, payload.price_10_min, payload.price_20_min, payload.price_30_min):
        if value < 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Prices must be non-negative")
    currency = payload.currency.strip().upper()
    if not currency:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Currency is required")
    row = get_platform_pricing(db)
    row.price_5_min = payload.price_5_min
    row.price_10_min = payload.price_10_min
    row.price_20_min = payload.price_20_min
    row.price_30_min = payload.price_30_min
    row.currency = currency[:8]
    row.is_active = payload.is_active
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _platform_pricing_out(row)


@router.post("/mentors/{mentor_id}/payout-account", response_model=AdminMentorPayoutAccountOut)
def admin_upsert_mentor_payout_account(
    mentor_id: str,
    payload: AdminMentorPayoutAccountUpsertRequest,
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminMentorPayoutAccountOut:
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")
    account = db.query(MentorPayoutAccount).filter(MentorPayoutAccount.mentor_id == mentor_id).first()
    now = datetime.now(timezone.utc)
    if not account:
        account = MentorPayoutAccount(
            id=new_uuid(),
            mentor_id=mentor_id,
            provider_name=payload.provider_name.strip(),
            provider_account_ref=payload.provider_account_ref.strip(),
            status=payload.status.strip() or "verified",
            verified_at=now if payload.status in ("verified", "active") else None,
            created_at=now,
            updated_at=now,
        )
        db.add(account)
    else:
        account.provider_name = payload.provider_name.strip()
        account.provider_account_ref = payload.provider_account_ref.strip()
        account.status = payload.status.strip() or account.status
        account.verified_at = now if account.status in ("verified", "active") else None
        account.updated_at = now
    db.commit()
    db.refresh(account)
    return AdminMentorPayoutAccountOut(
        mentor_id=account.mentor_id,
        provider_name=account.provider_name,
        provider_account_ref=account.provider_account_ref,
        status=account.status,
        verified_at=account.verified_at,
        account_holder_name=getattr(account, "account_holder_name", None),
        iban=getattr(account, "iban", None),
        bic=getattr(account, "bic", None),
    )


@router.get("/mentors/{mentor_id}/payout-bank-details", response_model=AdminMentorBankDetailsPrivateOut)
def admin_get_mentor_payout_bank_details(
    mentor_id: str,
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminMentorBankDetailsPrivateOut:
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")
    row = db.query(MentorPayoutAccount).filter(MentorPayoutAccount.mentor_id == mentor_id).first()
    if not row:
        return AdminMentorBankDetailsPrivateOut(
            mentor_id=mentor_id,
            has_bank_details=False,
            status="none",
            provider_name="",
            provider_account_ref="",
        )
    iban = getattr(row, "iban", None)
    has = bool(iban and str(iban).strip())
    return AdminMentorBankDetailsPrivateOut(
        mentor_id=mentor_id,
        has_bank_details=has,
        account_holder_name=row.account_holder_name if has else None,
        iban=iban if has else None,
        bic=row.bic if has else None,
        status=row.status or "pending",
        provider_name=row.provider_name,
        provider_account_ref=row.provider_account_ref,
        verified_at=row.verified_at,
        updated_at=row.updated_at,
    )


@router.get("/mentor-monthly-invoices", response_model=AdminMentorMonthlyInvoiceList)
def admin_list_mentor_monthly_invoices(
    db: DbSession,
    _admin: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AdminMentorMonthlyInvoiceList:
    query = db.query(MentorMonthlyInvoice)
    total = query.count()
    rows = query.order_by(MentorMonthlyInvoice.created_at.desc()).offset(skip).limit(limit).all()
    items: list[AdminMentorMonthlyInvoiceRow] = []
    for r in rows:
        mentor = db.query(Mentor).filter(Mentor.id == r.mentor_id).first()
        items.append(
            AdminMentorMonthlyInvoiceRow(
                id=r.id,
                mentor_id=r.mentor_id,
                mentor_name=mentor.full_name if mentor else r.mentor_id,
                invoice_month=r.invoice_month,
                gross_revenue=str(r.gross_revenue),
                fee_percent=str(r.fee_percent),
                fee_amount=str(r.fee_amount),
                currency=r.currency,
                status=r.status,
                mollie_checkout_url=r.mollie_checkout_url,
                paid_at=r.paid_at,
                reminder_sent_at=r.reminder_sent_at,
                created_at=r.created_at,
            )
        )
    return AdminMentorMonthlyInvoiceList(items=items, total=total, skip=skip, limit=limit)


@router.post("/mentor-monthly-invoices/{invoice_id}/regenerate-link", response_model=AdminMentorMonthlyInvoiceRow)
def admin_regenerate_mentor_monthly_invoice_link(
    invoice_id: str,
    db: DbSession,
    _admin: CurrentAdmin,
    checkout_currency: str = Query("EUR"),
) -> AdminMentorMonthlyInvoiceRow:
    inv = db.query(MentorMonthlyInvoice).filter(MentorMonthlyInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    mentor = db.query(Mentor).filter(Mentor.id == inv.mentor_id).first()
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coach not found")
    refreshed = create_or_refresh_monthly_invoice(db, mentor, inv.invoice_month, checkout_currency=checkout_currency.strip())
    if refreshed and refreshed.status != "paid":
        try:
            ensure_monthly_invoice_mollie_checkout(
                db,
                invoice=refreshed,
                mentor=mentor,
                checkout_currency=checkout_currency.strip(),
                webhook_url=resolve_mollie_webhook_url(None),
                force_new=True,
            )
        except FxCheckoutError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
        except FxUpstreamError as e:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e
        except MollieServiceError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    db.commit()
    if not refreshed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No billable revenue for this month")
    return AdminMentorMonthlyInvoiceRow(
        id=refreshed.id,
        mentor_id=refreshed.mentor_id,
        mentor_name=mentor.full_name,
        invoice_month=refreshed.invoice_month,
        gross_revenue=str(refreshed.gross_revenue),
        fee_percent=str(refreshed.fee_percent),
        fee_amount=str(refreshed.fee_amount),
        currency=refreshed.currency,
        status=refreshed.status,
        mollie_checkout_url=refreshed.mollie_checkout_url,
        paid_at=refreshed.paid_at,
        reminder_sent_at=refreshed.reminder_sent_at,
        created_at=refreshed.created_at,
    )


@router.post("/mentor-monthly-invoices/{invoice_id}/mark-reminder", response_model=AdminMentorMonthlyInvoiceRow)
def admin_mark_mentor_monthly_invoice_reminder(
    invoice_id: str,
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminMentorMonthlyInvoiceRow:
    inv = db.query(MentorMonthlyInvoice).filter(MentorMonthlyInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    inv.reminder_sent_at = datetime.now(timezone.utc)
    inv.updated_at = datetime.now(timezone.utc)
    db.commit()
    mentor = db.query(Mentor).filter(Mentor.id == inv.mentor_id).first()
    return AdminMentorMonthlyInvoiceRow(
        id=inv.id,
        mentor_id=inv.mentor_id,
        mentor_name=mentor.full_name if mentor else inv.mentor_id,
        invoice_month=inv.invoice_month,
        gross_revenue=str(inv.gross_revenue),
        fee_percent=str(inv.fee_percent),
        fee_amount=str(inv.fee_amount),
        currency=inv.currency,
        status=inv.status,
        mollie_checkout_url=inv.mollie_checkout_url,
        paid_at=inv.paid_at,
        reminder_sent_at=inv.reminder_sent_at,
        created_at=inv.created_at,
    )


@router.get("/mentor-monthly-invoices/{invoice_id}/pdf")
def admin_download_mentor_monthly_invoice_pdf(
    invoice_id: str,
    db: DbSession,
    _admin: CurrentAdmin,
) -> Response:
    inv = db.query(MentorMonthlyInvoice).filter(MentorMonthlyInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    mentor = db.query(Mentor).filter(Mentor.id == inv.mentor_id).first()
    pdf_bytes = build_mentor_monthly_invoice_pdf(invoice=inv, mentor=mentor)
    safe_name = f"mentor-monthly-invoice-{str(inv.invoice_month)}-{inv.id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/bookings", response_model=AdminBookingList)
def admin_list_bookings(
    db: DbSession,
    _admin: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AdminBookingList:
    query = db.query(Booking).options(joinedload(Booking.user), joinedload(Booking.mentor))
    total = query.count()
    rows = query.order_by(Booking.created_at.desc()).offset(skip).limit(limit).all()
    items: list[AdminBookingRow] = []
    for b in rows:
        uname = b.user.full_name if b.user else b.user_id
        mname = b.mentor.full_name if b.mentor else b.mentor_id
        items.append(
            AdminBookingRow(
                id=b.id,
                user_id=b.user_id,
                mentor_id=b.mentor_id,
                user_name=uname,
                mentor_name=mname,
                booking_date=b.booking_date,
                start_time=b.start_time,
                end_time=b.end_time,
                start_at_utc=b.start_at_utc,
                end_at_utc=b.end_at_utc,
                duration=b.duration,
                status=b.status,
                payment_status=b.payment_status,
                created_at=b.created_at,
            )
        )
    return AdminBookingList(items=items, total=total, skip=skip, limit=limit)


@router.get("/payments", response_model=AdminPaymentList)
def admin_list_payments(
    db: DbSession,
    _admin: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AdminPaymentList:
    query = db.query(Payment)
    total = query.count()
    rows = query.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()
    items = [AdminPaymentRow.model_validate(p) for p in rows]
    return AdminPaymentList(items=items, total=total, skip=skip, limit=limit)


@router.get("/booking-invoices", response_model=AdminBookingInvoiceList)
def admin_list_booking_invoices(
    db: DbSession,
    _admin: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AdminBookingInvoiceList:
    rows, total = list_admin_booking_invoices(db, skip=skip, limit=limit)
    items = [AdminBookingInvoiceRow.model_validate(r) for r in rows]
    return AdminBookingInvoiceList(items=items, total=total, skip=skip, limit=limit)


@router.get("/booking-invoices/{booking_id}/pdf")
def admin_download_booking_invoice_pdf(
    booking_id: str,
    db: DbSession,
    _admin: CurrentAdmin,
) -> Response:
    try:
        inv = load_booking_invoice(db, booking_id=booking_id, for_admin=True)
    except InvoiceError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e)) from e
    pdf_bytes = build_booking_invoice_pdf_from_out(inv)
    safe_name = f"booking-invoice-{inv.invoice_number.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/onboarding-invoices", response_model=AdminOnboardingInvoiceList)
def admin_list_onboarding_invoices(
    db: DbSession,
    _admin: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AdminOnboardingInvoiceList:
    rows, total = list_admin_onboarding_invoices(db, skip=skip, limit=limit)
    items = [AdminOnboardingInvoiceRow.model_validate(r) for r in rows]
    return AdminOnboardingInvoiceList(items=items, total=total, skip=skip, limit=limit)


@router.get("/transactions", response_model=AdminTransactionList)
def admin_list_all_transactions(
    db: DbSession,
    _admin: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AdminTransactionList:
    combined: list[AdminTransactionRow] = []

    for p in db.query(Payment).order_by(Payment.created_at.desc()).all():
        user = db.query(User).filter(User.id == p.user_id).first()
        combined.append(
            AdminTransactionRow(
                id=p.id,
                transaction_type="booking_payment",
                reference_id=p.booking_id,
                party_name=user.full_name if user else p.user_id,
                party_email=user.email if user else None,
                amount=str(p.amount),
                currency=str(p.currency or "EUR"),
                status=str(p.status),
                created_at=p.created_at,
            )
        )

    for cp in db.query(ChatPurchase).order_by(ChatPurchase.created_at.desc()).all():
        user = db.query(User).filter(User.id == cp.user_id).first()
        combined.append(
            AdminTransactionRow(
                id=cp.id,
                transaction_type="chat_purchase",
                reference_id=cp.session_id,
                party_name=user.full_name if user else cp.user_id,
                party_email=user.email if user else None,
                amount=str(cp.amount),
                currency=str(cp.currency or "EUR"),
                status=str(cp.status),
                created_at=cp.created_at,
            )
        )

    for ob in db.query(MentorOnboardingPayment).order_by(MentorOnboardingPayment.created_at.desc()).all():
        mentor = db.query(Mentor).filter(Mentor.id == ob.mentor_id).first()
        combined.append(
            AdminTransactionRow(
                id=ob.id,
                transaction_type="onboarding_payment",
                reference_id=ob.mentor_id,
                party_name=mentor.full_name if mentor else ob.mentor_id,
                party_email=mentor.email if mentor else None,
                amount=str(ob.amount),
                currency=str(ob.currency or "EUR"),
                status=str(ob.status),
                created_at=ob.created_at,
            )
        )

    for wt in db.query(WalletTransaction).order_by(WalletTransaction.created_at.desc()).all():
        wallet = db.query(Wallet).filter(Wallet.id == wt.wallet_id).first()
        user = db.query(User).filter(User.id == wallet.user_id).first() if wallet else None
        combined.append(
            AdminTransactionRow(
                id=wt.id,
                transaction_type=f"wallet_{wt.type}",
                reference_id=wt.reference_id,
                party_name=user.full_name if user else (wallet.user_id if wallet else "Unknown"),
                party_email=user.email if user else None,
                amount=str(wt.amount),
                currency=str(wallet.currency if wallet else "EUR"),
                status="completed",
                created_at=wt.created_at,
            )
        )

    combined.sort(key=lambda r: r.created_at, reverse=True)
    total = len(combined)
    page = combined[skip : skip + limit]
    return AdminTransactionList(items=page, total=total, skip=skip, limit=limit)


@router.get("/reviews", response_model=AdminReviewList)
def admin_list_reviews(
    db: DbSession,
    _admin: CurrentAdmin,
    lang: RequestLang,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AdminReviewList:
    query = db.query(Review).options(joinedload(Review.user), joinedload(Review.mentor))
    total = query.count()
    rows = query.order_by(Review.created_at.desc()).offset(skip).limit(limit).all()
    items: list[AdminReviewRow] = []
    for r in rows:
        uname = r.user.full_name if r.user else r.user_id
        mname = r.mentor.full_name if r.mentor else r.mentor_id
        items.append(
            AdminReviewRow(
                id=r.id,
                user_id=r.user_id,
                mentor_id=r.mentor_id,
                user_name=uname,
                mentor_name=mname,
                booking_id=r.booking_id,
                rating=r.rating,
                review_text=resolve_i18n_text(getattr(r, "review_text_i18n", None), r.review_text, lang),
                created_at=r.created_at,
            )
        )
    return AdminReviewList(items=items, total=total, skip=skip, limit=limit)


@router.get("/settlements/candidates", response_model=AdminSettlementCandidateList)
def admin_settlement_candidates(
    db: DbSession,
    _admin: CurrentAdmin,
    cycle_end: date | None = Query(None),
) -> AdminSettlementCandidateList:
    start, end = settlement_cycle_bounds(cycle_end)
    rows = compute_candidates(db, start, end)
    out = [
        AdminSettlementCandidateRow(
            mentor_id=r.mentor_id,
            mentor_name=r.mentor_name,
            currency=r.currency,
            gross_amount=str(r.gross_amount),
            fee_amount=str(r.fee_amount),
            net_amount=str(r.net_amount),
            item_count=r.item_count,
        )
        for r in rows
    ]
    return AdminSettlementCandidateList(cycle_start=start, cycle_end=end, candidates=out)


@router.post("/settlements/generate", response_model=AdminSettlementList)
def admin_generate_settlements(
    payload: AdminSettlementGenerateRequest,
    db: DbSession,
    admin: CurrentAdmin,
) -> AdminSettlementList:
    if payload.cycle_start and payload.cycle_end:
        start, end = payload.cycle_start, payload.cycle_end
    else:
        start, end = settlement_cycle_bounds(payload.cycle_end)
    try:
        rows = generate_settlements(db, cycle_start=start, cycle_end=end, created_by_admin_id=admin.id)
    except SettlementError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    items = [_settlement_row(db, s) for s in rows]
    return AdminSettlementList(items=items, total=len(items), skip=0, limit=len(items) or 1)


@router.get("/settlements", response_model=AdminSettlementList)
def admin_list_settlements(
    db: DbSession,
    _admin: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AdminSettlementList:
    query = db.query(MentorSettlement)
    total = query.count()
    rows = query.order_by(MentorSettlement.created_at.desc()).offset(skip).limit(limit).all()
    return AdminSettlementList(
        items=[_settlement_row(db, r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/settlements/{settlement_id}", response_model=AdminSettlementDetail)
def admin_get_settlement(
    settlement_id: str,
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminSettlementDetail:
    s = db.query(MentorSettlement).filter(MentorSettlement.id == settlement_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Settlement not found")
    base = _settlement_row(db, s)
    items = (
        db.query(MentorSettlementItem)
        .filter(MentorSettlementItem.settlement_id == settlement_id)
        .order_by(MentorSettlementItem.created_at.asc())
        .all()
    )
    return AdminSettlementDetail(
        **base.model_dump(),
        items=[
            AdminSettlementItemRow(
                id=i.id,
                source_type=i.source_type,
                source_id=i.source_id,
                amount=str(Decimal(str(i.amount)).quantize(Decimal("0.01"))),
                created_at=i.created_at,
            )
            for i in items
        ],
    )


@router.post("/settlements/{settlement_id}/approve", response_model=AdminSettlementRow)
def admin_approve_settlement(
    settlement_id: str,
    db: DbSession,
    admin: CurrentAdmin,
) -> AdminSettlementRow:
    s = db.query(MentorSettlement).filter(MentorSettlement.id == settlement_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Settlement not found")
    try:
        s = approve_settlement(db, s, admin.id)
    except SettlementError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return _settlement_row(db, s)


@router.post("/settlements/{settlement_id}/pay", response_model=AdminSettlementRow)
def admin_pay_settlement(
    settlement_id: str,
    payload: AdminSettlementPayRequest,
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminSettlementRow:
    s = db.query(MentorSettlement).filter(MentorSettlement.id == settlement_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Settlement not found")
    if s.status in ("processing", "paid"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Settlement already processing/paid")
    if s.status != "approved":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Settlement must be approved before payout")

    try:
        coach_acct, access_token = resolve_connect_access_token_for_payout(db, s.mentor_id)
    except MarketplaceError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    s.status = "processing"
    s.updated_at = datetime.now(timezone.utc)
    db.commit()

    reference = payload.idempotency_key or f"settlement_{s.id}"
    try:
        result = payout_gateway.create_payout(
            mentor_account_ref=coach_acct.provider_account_id or "",
            amount=str(Decimal(str(s.net_amount)).quantize(Decimal("0.01"))),
            currency=s.currency,
            reference=reference,
            access_token=access_token,
        )
        s.provider_batch_ref = result.provider_ref
        if result.status == "paid":
            s.status = "paid"
            s.paid_at = result.processed_at
            s.failure_reason = None
        else:
            s.status = "failed"
            s.failure_reason = f"Payout status: {result.status}"
    except Exception as e:
        s.status = "failed"
        s.failure_reason = str(e)
    s.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    return _settlement_row(db, s)


@router.post("/settlements/{settlement_id}/mark-paid", response_model=AdminSettlementRow)
def admin_mark_settlement_paid(
    settlement_id: str,
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminSettlementRow:
    s = db.query(MentorSettlement).filter(MentorSettlement.id == settlement_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Settlement not found")
    if s.status not in ("approved", "failed", "processing"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Settlement is not in a payable state")
    s.status = "paid"
    s.paid_at = datetime.now(timezone.utc)
    s.updated_at = datetime.now(timezone.utc)
    s.failure_reason = None
    db.commit()
    db.refresh(s)
    return _settlement_row(db, s)


@router.post("/wallets/{user_id}/credit", response_model=AdminWalletAdjustResponse)
def admin_credit_wallet(
    user_id: str,
    payload: AdminWalletAdjustRequest,
    db: DbSession,
    admin: CurrentAdmin,
) -> AdminWalletAdjustResponse:
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Amount must be positive")
    try:
        tx = credit_wallet(
            db,
            user_id=user_id,
            amount=payload.amount,
            description=payload.reason,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            admin_actor_id=admin.id,
            admin_actor_role="admin",
        )
    except WalletError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    wallet = get_or_create_wallet(db, user_id)
    return AdminWalletAdjustResponse(
        wallet_id=wallet.id,
        user_id=user_id,
        balance=str(Decimal(str(wallet.balance)).quantize(Decimal("0.01"))),
        transaction_id=tx.id,
        transaction_type=tx.type,
        amount=str(Decimal(str(tx.amount)).quantize(Decimal("0.01"))),
        created_at=tx.created_at,
    )


@router.post("/wallets/{user_id}/debit", response_model=AdminWalletAdjustResponse)
def admin_debit_wallet(
    user_id: str,
    payload: AdminWalletAdjustRequest,
    db: DbSession,
    admin: CurrentAdmin,
) -> AdminWalletAdjustResponse:
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Amount must be positive")
    try:
        tx = debit_wallet(
            db,
            user_id=user_id,
            amount=payload.amount,
            description=payload.reason,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            admin_actor_id=admin.id,
            admin_actor_role="admin",
        )
    except WalletError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    wallet = get_or_create_wallet(db, user_id)
    return AdminWalletAdjustResponse(
        wallet_id=wallet.id,
        user_id=user_id,
        balance=str(Decimal(str(wallet.balance)).quantize(Decimal("0.01"))),
        transaction_id=tx.id,
        transaction_type=tx.type,
        amount=str(Decimal(str(tx.amount)).quantize(Decimal("0.01"))),
        created_at=tx.created_at,
    )


@router.get("/wallets/analytics", response_model=AdminWalletAnalyticsResponse)
def admin_wallet_analytics(
    db: DbSession,
    _admin: CurrentAdmin,
) -> AdminWalletAnalyticsResponse:
    tx_rows = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.admin_actor_role == "admin")
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )
    by_user: dict[str, dict[str, object]] = {}
    total_credited = Decimal("0")
    total_debited = Decimal("0")

    for tx in tx_rows:
        wallet = db.query(Wallet).filter(Wallet.id == tx.wallet_id).first()
        if not wallet:
            continue
        user = db.query(User).filter(User.id == wallet.user_id).first()
        if not user:
            continue
        user_id = user.id
        if user_id not in by_user:
            by_user[user_id] = {
                "user_id": user.id,
                "user_name": user.full_name,
                "user_email": user.email,
                "currency": wallet.currency or "EUR",
                "credited_total": Decimal("0"),
                "debited_total": Decimal("0"),
                "transaction_count": 0,
                "last_transaction_at": None,
            }
        rec = by_user[user_id]
        amt = Decimal(str(tx.amount))
        if tx.type == "credit":
            rec["credited_total"] = Decimal(str(rec["credited_total"])) + amt
            total_credited += amt
        elif tx.type == "debit":
            rec["debited_total"] = Decimal(str(rec["debited_total"])) + amt
            total_debited += amt
        rec["transaction_count"] = int(rec["transaction_count"]) + 1
        if rec["last_transaction_at"] is None:
            rec["last_transaction_at"] = tx.created_at

    items: list[AdminWalletUserAnalyticsRow] = []
    for rec in by_user.values():
        credited = Decimal(str(rec["credited_total"]))
        debited = Decimal(str(rec["debited_total"]))
        items.append(
            AdminWalletUserAnalyticsRow(
                user_id=str(rec["user_id"]),
                user_name=str(rec["user_name"]),
                user_email=str(rec["user_email"]),
                currency=str(rec["currency"]),
                credited_total=str(credited.quantize(Decimal("0.01"))),
                debited_total=str(debited.quantize(Decimal("0.01"))),
                net_total=str((credited - debited).quantize(Decimal("0.01"))),
                transaction_count=int(rec["transaction_count"]),
                last_transaction_at=rec["last_transaction_at"],
            )
        )
    items.sort(key=lambda x: x.last_transaction_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return AdminWalletAnalyticsResponse(
        items=items,
        total_credited=str(total_credited.quantize(Decimal("0.01"))),
        total_debited=str(total_debited.quantize(Decimal("0.01"))),
        total_net=str((total_credited - total_debited).quantize(Decimal("0.01"))),
    )


@router.get("/chat-invoices", response_model=list[ChatInvoiceSummaryOut])
def admin_list_chat_invoices(
    db: DbSession,
    _admin: CurrentAdmin,
) -> list[ChatInvoiceSummaryOut]:
    sessions = db.query(ChatSession).order_by(ChatSession.updated_at.desc()).all()
    out: list[ChatInvoiceSummaryOut] = []
    for session in sessions:
        user = db.query(User).filter(User.id == session.user_id).first()
        mentor = db.query(Mentor).filter(Mentor.id == session.mentor_id).first()
        if not user or not mentor:
            continue
        purchases = (
            db.query(ChatPurchase)
            .filter(ChatPurchase.session_id == session.id)
            .order_by(ChatPurchase.created_at.asc())
            .all()
        )
        if not purchases:
            continue
        total, minutes, currency = aggregate_purchases(purchases)
        issued = max(p.created_at for p in purchases)
        out.append(
            ChatInvoiceSummaryOut(
                session_id=session.id,
                invoice_number=_invoice_number(session.id),
                mentor_name=mentor.full_name,
                customer_display_name=user.full_name,
                total_amount=str(total.quantize(Decimal("0.01"))),
                currency=currency,
                total_minutes_purchased=minutes,
                payment_status="paid",
                session_started_at=session.created_at,
                session_ended_at=session.updated_at,
                issued_at=issued,
            )
        )
    return out


@router.get("/chat-invoices/{session_id}", response_model=ChatInvoiceDetailOut)
def admin_get_chat_invoice(
    session_id: str,
    db: DbSession,
    _admin: CurrentAdmin,
    lang: RequestLang,
) -> ChatInvoiceDetailOut:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    user = db.query(User).filter(User.id == session.user_id).first()
    mentor = db.query(Mentor).filter(Mentor.id == session.mentor_id).first()
    if not user or not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    purchases = (
        db.query(ChatPurchase)
        .filter(ChatPurchase.session_id == session.id)
        .order_by(ChatPurchase.created_at.asc())
        .all()
    )
    if not purchases:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    total, minutes, currency = aggregate_purchases(purchases)
    issued = max(p.created_at for p in purchases)
    lines = [
        ChatInvoiceLineOut(
            id=p.id,
            minutes=p.minutes,
            amount=str(Decimal(str(p.amount)).quantize(Decimal("0.01"))),
            currency=p.currency,
            status=p.status,
            transaction_id=p.transaction_id,
            created_at=p.created_at,
        )
        for p in purchases
    ]

    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    conversation = [
        ChatInvoiceConversationLineOut(
            id=m.id,
            sender_role=m.sender_role,
            sender_display_name=user.full_name if m.sender_role == CHAT_SENDER_USER else mentor.full_name,
            body=resolve_i18n_text(getattr(m, "body_i18n", None), m.body, lang) or m.body,
            created_at=m.created_at,
        )
        for m in msgs
    ]

    return ChatInvoiceDetailOut(
        invoice_number=_invoice_number(session.id),
        issued_at=issued,
        payment_status="paid",
        session_id=session.id,
        session_status=session.status,
        session_started_at=session.created_at,
        session_ended_at=session.updated_at,
        session_duration_seconds=_session_wall_duration_seconds(session),
        total_minutes_purchased=minutes,
        total_amount=str(total.quantize(Decimal("0.01"))),
        currency=currency,
        bill_to_name=user.full_name,
        bill_to_email=user.email,
        bill_to_phone=user.phone_number,
        service_provider_name=mentor.full_name,
        service_provider_email=mentor.email,
        line_items=lines,
        conversation=conversation,
    )


@router.get("/chat-invoices/{session_id}/pdf")
def admin_download_chat_invoice_pdf(
    session_id: str,
    db: DbSession,
    _admin: CurrentAdmin,
) -> Response:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    user = db.query(User).filter(User.id == session.user_id).first()
    mentor = db.query(Mentor).filter(Mentor.id == session.mentor_id).first()
    if not user or not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    purchases = (
        db.query(ChatPurchase)
        .filter(ChatPurchase.session_id == session.id)
        .order_by(ChatPurchase.created_at.asc())
        .all()
    )
    if not purchases:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    inv = _invoice_number(session.id)
    pdf_bytes = build_chat_invoice_pdf(
        invoice_number=inv,
        session=session,
        user=user,
        mentor=mentor,
        purchases=purchases,
        messages=messages,
    )
    safe_name = f"admin-invoice-{inv.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


def _revenue_sum(db: DbSession, start: datetime, end: datetime) -> Decimal:
    q = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(_in_range(Payment, start, end))
        .filter(Payment.status.in_(["completed", "paid", "succeeded"]))
    )
    v = q.scalar()
    if v is None:
        return Decimal("0")
    return Decimal(str(v))


def _count_in_range(db: DbSession, model, start: datetime, end: datetime) -> int:
    return int(
        db.query(func.count(model.id)).filter(_in_range(model, start, end)).scalar() or 0,
    )


def _series_counts(db: DbSession, model, start: datetime, end: datetime) -> list[DateCountPoint]:
    day = func.date(model.created_at)
    rows = (
        db.query(day, func.count(model.id))
        .select_from(model)
        .filter(_in_range(model, start, end))
        .group_by(day)
        .order_by(day)
        .all()
    )
    out: list[DateCountPoint] = []
    for d, c in rows:
        if d is None:
            continue
        ds = d.isoformat() if isinstance(d, date) else str(d)
        out.append(DateCountPoint(date=ds, count=int(c)))
    return out


def _series_payment_amounts(db: DbSession, start: datetime, end: datetime) -> list[DateAmountPoint]:
    day = func.date(Payment.created_at)
    rows = (
        db.query(day, func.coalesce(func.sum(Payment.amount), 0))
        .filter(_in_range(Payment, start, end))
        .filter(Payment.status.in_(["completed", "paid", "succeeded"]))
        .group_by(day)
        .order_by(day)
        .all()
    )
    out: list[DateAmountPoint] = []
    for d, amt in rows:
        if d is None:
            continue
        ds = d.isoformat() if isinstance(d, date) else str(d)
        out.append(DateAmountPoint(date=ds, amount=str(amt)))
    return out


@router.get("/analytics", response_model=AnalyticsResponse)
def admin_analytics(
    db: DbSession,
    _admin: CurrentAdmin,
    period: Period = Query("month"),
) -> AnalyticsResponse:
    start, end = _period_bounds(period)
    bookings_n = _count_in_range(db, Booking, start, end)
    users_n = _count_in_range(db, User, start, end)
    mentors_n = _count_in_range(db, Mentor, start, end)
    reviews_n = _count_in_range(db, Review, start, end)
    rev = _revenue_sum(db, start, end)
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_mentors = db.query(func.count(Mentor.id)).scalar() or 0
    total_payments = db.query(func.count(Payment.id)).scalar() or 0
    paid_payments = db.query(func.count(Payment.id)).filter(Payment.status == "paid").scalar() or 0
    pending_payments = db.query(func.count(Payment.id)).filter(Payment.status == "pending").scalar() or 0

    summary = AnalyticsSummary(
        bookings=bookings_n,
        new_users=users_n,
        new_mentors=mentors_n,
        reviews=reviews_n,
        revenue=str(rev),
        total_users=total_users,
        total_mentors=total_mentors,
        total_payments=total_payments,
        paid_payments=paid_payments,
        pending_payments=pending_payments,
    )

    return AnalyticsResponse(
        period=period,
        range_start=start,
        range_end=end,
        summary=summary,
        bookings_by_day=_series_counts(db, Booking, start, end),
        payments_by_day=_series_payment_amounts(db, start, end),
        reviews_by_day=_series_counts(db, Review, start, end),
        users_by_day=_series_counts(db, User, start, end),
        mentors_by_day=_series_counts(db, Mentor, start, end),
    )
