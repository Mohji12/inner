from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

import hmac
import hashlib
import json
import httpx
import logging
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from starlette.requests import Request

from core.booking_states import PAYMENT_PAID, PAYMENT_RECORD_SUCCEEDED, STATUS_CONFIRMED
from core.config import settings
from services.ledger_service import q2 as q2_money
from services.fx_checkout import FxCheckoutError, format_mollie_amount, parse_amount_from_mollie_payload
from services.promo_service import apply_promo_code
from models.booking import Booking
from models.availability_slot import AvailabilitySlot
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.mentor import Mentor
from models.mentor_monthly_invoice import MentorMonthlyInvoice
from models.mentor_onboarding_payment import MentorOnboardingPayment
from models.payment import Payment
from models.user import User
from core.security import new_uuid
from core.chat_states import CHAT_PURCHASE_FAILED, CHAT_PURCHASE_SUCCEEDED, CHAT_SESSION_ACTIVE, CHAT_SESSION_PAUSED


logger = logging.getLogger(__name__)


class MollieServiceError(Exception):
    pass


def _connect_token_request(data: dict[str, Any]) -> dict[str, Any]:
    with httpx.Client(timeout=20) as client:
        resp = client.post(
            settings.mollie_connect_token_url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data=data,
        )
    if resp.status_code >= 300:
        raise MollieServiceError(f"Mollie Connect token request failed: {resp.text}")
    out = resp.json()
    if not isinstance(out, dict) or not out.get("access_token"):
        raise MollieServiceError("Invalid Mollie Connect token response")
    return out


def exchange_connect_code_for_token(code: str) -> dict[str, Any]:
    if not settings.mollie_client_id or not settings.mollie_client_secret or not settings.mollie_connect_redirect_uri:
        raise MollieServiceError("Mollie Connect OAuth credentials are not configured")
    return _connect_token_request(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.mollie_connect_redirect_uri,
            "client_id": settings.mollie_client_id,
            "client_secret": settings.mollie_client_secret,
        }
    )


def refresh_connect_token(refresh_token: str) -> dict[str, Any]:
    if not settings.mollie_client_id or not settings.mollie_client_secret:
        raise MollieServiceError("Mollie Connect OAuth credentials are not configured")
    return _connect_token_request(
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.mollie_client_id,
            "client_secret": settings.mollie_client_secret,
        }
    )


def _connect_headers(access_token: str) -> dict[str, str]:
    token = (access_token or "").strip()
    if not token:
        raise MollieServiceError("Missing Mollie Connect access token")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _connect_get(path: str, access_token: str) -> dict[str, Any]:
    with httpx.Client(timeout=20) as client:
        resp = client.get(f"{settings.mollie_api_base}{path}", headers=_connect_headers(access_token))
    if resp.status_code >= 300:
        raise MollieServiceError(f"Mollie Connect GET {path} failed: {resp.text}")
    data = resp.json()
    return data if isinstance(data, dict) else {}


def fetch_connected_account_profile(access_token: str) -> dict[str, Any]:
    org = _connect_get("/organizations/me", access_token)
    profile: dict[str, Any] = {}
    try:
        profile = _connect_get("/profiles/me", access_token)
    except MollieServiceError:
        profile = {}
    return {"organization": org, "profile": profile}


def fetch_connected_account_capabilities(access_token: str) -> dict[str, Any]:
    onboarding: dict[str, Any] = {}
    organization: dict[str, Any] = {}
    try:
        onboarding = _connect_get("/onboarding/me", access_token)
    except MollieServiceError:
        onboarding = {}
    try:
        organization = _connect_get("/organizations/me", access_token)
    except MollieServiceError:
        organization = {}

    can_receive_settlements = bool(
        onboarding.get("canReceiveSettlements")
        or organization.get("canReceiveSettlements")
        or organization.get("canReceivePayments")
    )
    verification_status = str(
        onboarding.get("status")
        or organization.get("status")
        or ("verified" if can_receive_settlements else "pending")
    )
    dashboard_href: str | None = None
    try:
        links = onboarding.get("_links") if isinstance(onboarding, dict) else None
        if isinstance(links, dict):
            dash = links.get("dashboard")
            if isinstance(dash, dict) and dash.get("href"):
                dashboard_href = str(dash.get("href")).strip() or None
    except Exception:
        dashboard_href = None
    return {
        "can_receive_settlements": can_receive_settlements,
        "verification_status": verification_status,
        "onboarding": onboarding,
        "organization": organization,
        "dashboard_href": dashboard_href,
    }


def fetch_connect_settlement_available(access_token: str, currency: str) -> tuple[Decimal | None, str | None]:
    """
    Sum availableAmount for balances matching currency (Mollie Balances API).
    Requires OAuth scope balances.read. Returns (None, reason) if the call fails or is forbidden.
    """
    ccy = (currency or "EUR").strip().upper()
    try:
        data = _connect_get(f"/balances?currency={ccy}", access_token)
    except MollieServiceError as exc:
        return None, str(exc)
    embedded = data.get("_embedded") if isinstance(data, dict) else None
    balances = embedded.get("balances") if isinstance(embedded, dict) else None
    if not isinstance(balances, list):
        return None, "unexpected_balances_response"
    total = Decimal("0")
    for bal in balances:
        if not isinstance(bal, dict):
            continue
        if str(bal.get("currency") or "").upper() != ccy:
            continue
        avail = bal.get("availableAmount")
        if isinstance(avail, dict) and avail.get("value") is not None:
            try:
                total += Decimal(str(avail["value"]))
            except Exception:
                continue
    return q2_money(total), None


def get_connected_account_payout(*, access_token: str, payout_id: str) -> dict[str, Any]:
    pid = (payout_id or "").strip()
    if not pid:
        raise MollieServiceError("Missing payout id")
    with httpx.Client(timeout=20) as client:
        resp = client.get(
            f"{settings.mollie_api_base}/payouts/{pid}",
            headers=_connect_headers(access_token),
        )
    if resp.status_code >= 300:
        raise MollieServiceError(f"Mollie get payout failed: {resp.text}")
    data = resp.json()
    return data if isinstance(data, dict) else {}


def fetch_masked_payout_destination(access_token: str) -> dict[str, str | None]:
    org = _connect_get("/organizations/me", access_token)
    bank_obj = (
        org.get("bankAccount")
        or org.get("bank_account")
        or ((org.get("settlement") or {}).get("bankAccount"))
        or {}
    )
    bank_name = (
        bank_obj.get("bankName")
        or bank_obj.get("name")
        or org.get("name")
        or None
    )
    raw_iban = str(bank_obj.get("iban") or bank_obj.get("accountNumber") or "").strip()
    masked = None
    if raw_iban:
        masked = f"****{raw_iban[-4:]}"
    return {"bank_name": bank_name, "bank_last4": masked}


def create_connected_account_payout(
    *,
    access_token: str,
    amount: Decimal,
    currency: str,
    reference: str,
) -> dict[str, Any]:
    body = {
        "amount": _amount_obj(amount, currency),
        "description": reference,
    }
    with httpx.Client(timeout=20) as client:
        resp = client.post(f"{settings.mollie_api_base}/payouts", headers=_connect_headers(access_token), json=body)
    if resp.status_code >= 300:
        raise MollieServiceError(f"Mollie create payout failed: {resp.text}")
    data = resp.json()
    if not isinstance(data, dict) or not data.get("id"):
        raise MollieServiceError("Invalid Mollie payout response")
    return data


def resolve_mollie_webhook_url(request: Request | None = None) -> str | None:
    """
    Mollie POSTs to webhookUrl when payment status changes.

    MOLLIE_WEBHOOK_BASE_URL must be the **public origin of your FastAPI server** (HTTPS) where
    `POST /api/v1/payments/webhook` exists. A static Amplify *frontend-only* URL will not work
    unless you proxy `/api/*` to this backend.

    If unset/localhost, webhookUrl is omitted (Mollie test mode still works): the SPA can call
    POST /payments/sync-mollie-payment after redirect to finalize from Mollie API.
    """
    configured = (settings.mollie_webhook_base_url or "").strip()
    if configured:
        return f"{configured.rstrip('/')}/api/v1/payments/webhook"

    if request is not None:
        try:
            candidate = str(request.url_for("mollie_webhook")).strip()
        except Exception:
            return None
        if not candidate:
            return None
        host = (urlparse(candidate).hostname or "").lower()
        if host in ("localhost", "127.0.0.1", "0.0.0.0") or host.endswith(".local"):
            return None
        return candidate

    return None


def _headers() -> dict[str, str]:
    if not settings.mollie_api_key:
        raise MollieServiceError("Mollie API key not configured")
    return {
        "Authorization": f"Bearer {settings.mollie_api_key}",
        "Content-Type": "application/json",
    }


def _amount_obj(amount: Decimal, currency: str) -> dict[str, str]:
    try:
        return format_mollie_amount(amount, currency)
    except FxCheckoutError as e:
        raise MollieServiceError(str(e)) from e


def create_mollie_payment(
    *,
    amount: Decimal,
    currency: str,
    description: str,
    redirect_url: str,
    webhook_url: str | None,
    metadata: dict[str, Any],
) -> tuple[str, str]:
    body: dict[str, Any] = {
        "amount": _amount_obj(amount, currency),
        "description": description,
        "redirectUrl": redirect_url,
        "metadata": metadata,
    }
    if webhook_url:
        body["webhookUrl"] = webhook_url
    else:
        logger.info(
            "Mollie payment without webhookUrl — set MOLLIE_WEBHOOK_BASE_URL to your public API origin for production webhooks."
        )
    with httpx.Client(timeout=20) as client:
        resp = client.post(f"{settings.mollie_api_base}/payments", headers=_headers(), json=body)
    if resp.status_code >= 300:
        raise MollieServiceError(f"Mollie create payment failed: {resp.text}")
    data = resp.json()
    payment_id = data.get("id")
    checkout_url = ((data.get("_links") or {}).get("checkout") or {}).get("href")
    if not payment_id or not checkout_url:
        raise MollieServiceError("Invalid Mollie payment response")
    return payment_id, checkout_url


def get_mollie_payment(payment_id: str) -> dict[str, Any]:
    with httpx.Client(timeout=20) as client:
        resp = client.get(f"{settings.mollie_api_base}/payments/{payment_id}", headers=_headers())
    if resp.status_code >= 300:
        raise MollieServiceError(f"Mollie fetch payment failed: {resp.text}")
    return resp.json()


def verify_mollie_webhook_signature(raw_body: bytes, signature_header: str | None) -> bool:
    secret = (settings.mollie_webhook_secret or "").strip()
    if not secret:
        return True  # optional in dev
    if not signature_header:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.strip())


def _dt_utc(dt: datetime | None, *, fallback_combine: datetime | None) -> datetime:
    """Normalize booking timestamps to timezone-aware UTC."""
    if dt is not None:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    if fallback_combine is not None:
        if fallback_combine.tzinfo is None:
            return fallback_combine.replace(tzinfo=timezone.utc)
        return fallback_combine.astimezone(timezone.utc)
    return datetime.now(timezone.utc)


def _live_session_window_on_payment(booking: Booking, *, now: datetime) -> tuple[datetime, datetime, int]:
    """Live bookings: join deadline starts at payment; billed timer starts when both join."""
    duration_minutes = max(1, int(booking.duration or 5))
    start_dt = now
    join_deadline = now + timedelta(minutes=30)
    booking.start_at_utc = start_dt
    booking.end_at_utc = join_deadline
    booking.booking_date = start_dt.date()
    booking.start_time = start_dt.time().replace(microsecond=0)
    booking.end_time = join_deadline.time().replace(microsecond=0)
    return start_dt, join_deadline, duration_minutes


def _mark_booking_paid(db: Session, payment: Payment) -> None:
    from services.notification_service import create_notification

    payment.status = PAYMENT_RECORD_SUCCEEDED
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    if booking:
        booking.payment_status = PAYMENT_PAID
        booking.status = STATUS_CONFIRMED
        booking.payment_id = payment.id
        now = datetime.now(timezone.utc)
        _, join_deadline, duration_minutes = _live_session_window_on_payment(booking, now=now)
        slot = db.query(AvailabilitySlot).filter(AvailabilitySlot.id == booking.slot_id).first()
        if slot:
            slot.is_booked = True
            slot.start_at_utc = booking.start_at_utc
            slot.end_at_utc = booking.end_at_utc
        session_id: str | None = None
        mode = (booking.communication_mode or "video").strip().lower()
        if mode not in ("video", "call"):
            mode = "video"
        # Chat session is created paused; billed timer starts when both participants join.
        if not booking.meeting_link:
            session = ChatSession(
                id=new_uuid(),
                user_id=booking.user_id,
                mentor_id=booking.mentor_id,
                status=CHAT_SESSION_PAUSED,
                ends_at=join_deadline,
                allocated_duration_minutes=duration_minutes,
                user_joined_at=None,
                mentor_joined_at=None,
                timer_started_at=None,
                created_at=now,
                updated_at=now,
                last_message_at=None,
                unread_count_user=0,
                unread_count_mentor=0,
            )
            db.add(session)
            session_id = session.id
            booking.meeting_link = f"/user/chat/{session.id}?mode={mode}"
        else:
            needle = "/chat/"
            if needle in booking.meeting_link:
                session_id = booking.meeting_link.split(needle, 1)[1].split("?", 1)[0]
                existing = (
                    db.query(ChatSession)
                    .filter(ChatSession.id == session_id)
                    .with_for_update()
                    .first()
                )
                if existing and existing.timer_started_at is None:
                    existing.allocated_duration_minutes = duration_minutes
                    existing.ends_at = join_deadline
                    existing.status = CHAT_SESSION_PAUSED
                    existing.user_joined_at = None
                    existing.mentor_joined_at = None
                    existing.timer_started_at = None
                    existing.updated_at = now

        user = db.query(User).filter(User.id == booking.user_id).first()
        user_name = user.full_name if user else "A user"
        comm_label = "video" if mode == "video" else "phone call"

        if session_id:
            create_notification(
                db,
                type="booking_confirmed",
                title="Session ready to join",
                body=f"{user_name} paid for a {duration_minutes}-minute {comm_label} session. Join now.",
                link=f"/mentor/chat/{session_id}",
                mentor_id=booking.mentor_id,
            )
            create_notification(
                db,
                type="booking_confirmed",
                title="Session confirmed",
                body=f"Your {duration_minutes}-minute {comm_label} session is ready. Join when your coach enters.",
                link=f"/user/chat/{session_id}?mode={mode}",
                user_id=booking.user_id,
            )


def _mark_monthly_invoice_paid(db: Session, invoice: MentorMonthlyInvoice) -> None:
    invoice.status = "paid"
    invoice.paid_at = datetime.now(timezone.utc)
    invoice.updated_at = datetime.now(timezone.utc)


def _apply_chat_purchase_paid(db: Session, purchase: ChatPurchase) -> None:
    purchase.status = CHAT_PURCHASE_SUCCEEDED
    session = db.query(ChatSession).filter(ChatSession.id == purchase.session_id).with_for_update().first()
    if not session:
        return
    now = datetime.now(timezone.utc)
    base = session.ends_at
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    session.ends_at = max(now, base) + timedelta(minutes=int(purchase.minutes))
    session.status = CHAT_SESSION_ACTIVE
    session.updated_at = now


def _mark_onboarding_paid(db: Session, onboarding: MentorOnboardingPayment) -> None:
    from services.onboarding_payment_service import apply_onboarding_payment_paid

    apply_onboarding_payment_paid(db, onboarding)


def _sync_amount_currency_from_mollie(
    row: Payment | ChatPurchase | MentorOnboardingPayment,
    payment_data: dict[str, Any],
    *,
    status_str: str,
) -> None:
    """When Mollie settles, align stored charge rows with `amount` from the API (rounding / scheme differences)."""
    if status_str != "paid":
        return
    parsed = parse_amount_from_mollie_payload(payment_data)
    if not parsed:
        return
    amt, cur = parsed
    if hasattr(row, "amount"):
        row.amount = amt
    if hasattr(row, "currency"):
        row.currency = cur


def process_mollie_webhook_by_payment_id(db: Session, mollie_payment_id: str) -> dict[str, str]:
    payment_data = get_mollie_payment(mollie_payment_id)
    status_str = str(payment_data.get("status") or "unknown")

    booking_payment = db.query(Payment).filter(Payment.transaction_id == mollie_payment_id).with_for_update().first()
    if booking_payment:
        _sync_amount_currency_from_mollie(booking_payment, payment_data, status_str=status_str)
        if status_str == "paid":
            _mark_booking_paid(db, booking_payment)
            metadata = payment_data.get("metadata") or {}
            promo_code = str(metadata.get("promo_code") or "").strip()
            if promo_code:
                apply_promo_code(db, promo_code)
        elif status_str in ("failed", "canceled", "expired"):
            booking_payment.status = "failed"
        db.commit()
        return {"status": status_str, "type": "booking_payment"}

    onboarding = (
        db.query(MentorOnboardingPayment)
        .filter(MentorOnboardingPayment.mollie_payment_id == mollie_payment_id)
        .with_for_update()
        .first()
    )
    if onboarding:
        _sync_amount_currency_from_mollie(onboarding, payment_data, status_str=status_str)
        onboarding.status = status_str
        if status_str == "paid":
            _mark_onboarding_paid(db, onboarding)
        db.commit()
        return {"status": status_str, "type": "mentor_onboarding"}

    monthly = (
        db.query(MentorMonthlyInvoice)
        .filter(MentorMonthlyInvoice.mollie_payment_id == mollie_payment_id)
        .with_for_update()
        .first()
    )
    if monthly:
        if status_str == "paid":
            parsed = parse_amount_from_mollie_payload(payment_data)
            if parsed:
                amt, cur = parsed
                monthly.checkout_amount = amt
                monthly.checkout_currency = cur
        monthly.status = status_str
        if status_str == "paid":
            _mark_monthly_invoice_paid(db, monthly)
        db.commit()
        return {"status": status_str, "type": "mentor_monthly_invoice"}

    chat_purchase = (
        db.query(ChatPurchase)
        .filter(ChatPurchase.transaction_id == mollie_payment_id)
        .with_for_update()
        .first()
    )
    if chat_purchase:
        _sync_amount_currency_from_mollie(chat_purchase, payment_data, status_str=status_str)
        if status_str == "paid":
            if chat_purchase.status != CHAT_PURCHASE_SUCCEEDED:
                _apply_chat_purchase_paid(db, chat_purchase)
        elif status_str in ("failed", "canceled", "expired"):
            chat_purchase.status = CHAT_PURCHASE_FAILED
        db.commit()
        return {"status": status_str, "type": "chat_purchase"}

    return {"status": status_str, "type": "unmatched"}


def parse_webhook_payment_id(raw_body: bytes, form_data: dict[str, Any] | None = None) -> str:
    if form_data and form_data.get("id"):
        return str(form_data["id"])
    try:
        payload = json.loads(raw_body.decode("utf-8") or "{}")
    except Exception:
        payload = {}
    pid = payload.get("id")
    if not pid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing payment id")
    return str(pid)

