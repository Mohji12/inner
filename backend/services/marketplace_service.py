from __future__ import annotations

import hashlib
import hmac
import json
from base64 import urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import urlencode

from sqlalchemy.orm import Session

from core.config import settings
from core.security import new_uuid
from models.marketplace import (
    AuditLog,
    CapabilityMatrix,
    CoachConnectAccount,
    CoachPayoutAttempt,
    CoachPayoutRequest,
    WebhookEventLog,
)
from services.ledger_service import (
    ACCOUNT_COACH_WITHDRAWABLE,
    LedgerError,
    OWNER_COACH,
    get_account_balance,
    get_or_create_wallet_account,
    q2,
    settle_coach_payout_to_platform_cash,
)
from services.mollie_service import (
    MollieServiceError,
    exchange_connect_code_for_token,
    fetch_connect_settlement_available,
    fetch_connected_account_capabilities,
    fetch_connected_account_profile,
    fetch_masked_payout_destination,
    refresh_connect_token,
)
from services.payout_gateway import payout_gateway


class MarketplaceError(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def audit_log(
    db: Session,
    *,
    actor_role: str,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            id=new_uuid(),
            actor_role=actor_role,
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details_json=details,
            created_at=_utcnow(),
        )
    )


def upsert_capability(
    db: Session,
    *,
    country_code: str,
    entity_type: str,
    currency: str,
    supports_connect: bool,
    supports_payouts: bool,
    supports_transfers: bool,
    notes: str | None,
) -> CapabilityMatrix:
    cc = country_code.strip().upper()
    ccy = currency.strip().upper()
    row = (
        db.query(CapabilityMatrix)
        .filter(
            CapabilityMatrix.country_code == cc,
            CapabilityMatrix.entity_type == entity_type,
            CapabilityMatrix.currency == ccy,
        )
        .first()
    )
    if not row:
        row = CapabilityMatrix(
            id=new_uuid(),
            country_code=cc,
            entity_type=entity_type,
            currency=ccy,
            supports_connect=supports_connect,
            supports_payouts=supports_payouts,
            supports_transfers=supports_transfers,
            notes=notes,
            is_active=True,
            updated_at=_utcnow(),
        )
        db.add(row)
    else:
        row.supports_connect = supports_connect
        row.supports_payouts = supports_payouts
        row.supports_transfers = supports_transfers
        row.notes = notes
        row.is_active = True
        row.updated_at = _utcnow()
    db.flush()
    return row


def get_or_create_connect_account(db: Session, mentor_id: str) -> CoachConnectAccount:
    row = db.query(CoachConnectAccount).filter(CoachConnectAccount.mentor_id == mentor_id).first()
    if row:
        return row
    row = CoachConnectAccount(
        id=new_uuid(),
        mentor_id=mentor_id,
        provider="mollie",
        provider_account_id=None,
        provider_account_label=None,
        provider_account_masked=None,
        onboarding_state="not_started",
        kyc_status="pending",
        payouts_enabled=False,
        connect_access_token=None,
        connect_refresh_token=None,
        connect_token_type=None,
        connect_scope=None,
        connect_token_expires_at=None,
        capabilities_status=None,
        capabilities_json=None,
        tax_country=None,
        tax_type=None,
        onboarding_redirect_url=None,
        last_synced_at=None,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(row)
    db.flush()
    return row


def build_mollie_connect_authorize_url(*, state: str) -> str:
    if not settings.mollie_client_id or not settings.mollie_connect_redirect_uri:
        raise MarketplaceError("Mollie Connect OAuth is not configured")
    query = urlencode(
        {
            "client_id": settings.mollie_client_id,
            "redirect_uri": settings.mollie_connect_redirect_uri,
            "response_type": "code",
            "approval_prompt": "auto",
            "state": state,
            # onboarding.write lets the merchant complete data entry in Mollie; dashboard link also comes from /onboarding/me.
            "scope": "onboarding.read onboarding.write organizations.read profiles.read balances.read",
        }
    )
    return f"{settings.mollie_connect_auth_url}?{query}"


def start_connect_onboarding(
    db: Session,
    *,
    mentor_id: str,
    frontend_base_url: str | None = None,
) -> tuple[CoachConnectAccount, str]:
    acct = get_or_create_connect_account(db, mentor_id)
    frontend = (frontend_base_url or "").strip().rstrip("/")
    frontend_token = ""
    if frontend:
        frontend_token = urlsafe_b64encode(frontend.encode("utf-8")).decode("ascii")
    state = f"{mentor_id}:{new_uuid()}"
    if frontend_token:
        state = f"{state}:{frontend_token}"
    url = build_mollie_connect_authorize_url(state=state)
    acct.onboarding_state = "redirected"
    acct.onboarding_redirect_url = url
    acct.updated_at = _utcnow()
    db.flush()
    return acct, url


def complete_connect_callback(
    db: Session,
    *,
    mentor_id: str,
    provider_account_id: str | None,
    kyc_status: str,
    payouts_enabled: bool,
    capabilities: dict | None,
) -> CoachConnectAccount:
    acct = get_or_create_connect_account(db, mentor_id)
    if provider_account_id:
        acct.provider_account_id = provider_account_id
    acct.kyc_status = kyc_status
    acct.payouts_enabled = payouts_enabled
    acct.capabilities_json = capabilities
    acct.onboarding_state = "verified" if payouts_enabled else "pending_verification"
    acct.last_synced_at = _utcnow()
    acct.updated_at = _utcnow()
    db.flush()
    return acct


def _to_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _token_expiry_from_payload(token_payload: dict) -> datetime | None:
    expires_in_raw = token_payload.get("expires_in")
    if expires_in_raw is None:
        return None
    try:
        expires_in = int(expires_in_raw)
    except (TypeError, ValueError):
        return None
    return _utcnow() + timedelta(seconds=max(0, expires_in))


def _save_connect_token_payload(acct: CoachConnectAccount, token_payload: dict) -> None:
    acct.connect_access_token = token_payload.get("access_token")
    if token_payload.get("refresh_token"):
        acct.connect_refresh_token = token_payload.get("refresh_token")
    acct.connect_token_type = token_payload.get("token_type")
    acct.connect_scope = token_payload.get("scope")
    acct.connect_token_expires_at = _token_expiry_from_payload(token_payload)


def _apply_fetched_connect_data(
    acct: CoachConnectAccount,
    combined_profile: dict,
    capabilities: dict,
    masked_destination: dict,
) -> None:
    """Map Mollie profile/capabilities responses onto `CoachConnectAccount`."""
    organization = combined_profile.get("organization") if isinstance(combined_profile, dict) else {}
    if isinstance(organization, dict):
        acct.provider_account_id = organization.get("id") or acct.provider_account_id
        acct.provider_account_label = organization.get("name") or acct.provider_account_label
        acct.tax_country = (
            organization.get("address", {}).get("country")
            if isinstance(organization.get("address"), dict)
            else acct.tax_country
        )
        acct.tax_type = organization.get("registrationNumber") or acct.tax_type

    acct.provider_account_masked = masked_destination.get("bank_last4")
    can_receive_settlements = bool(capabilities.get("can_receive_settlements"))
    acct.payouts_enabled = can_receive_settlements
    acct.kyc_status = str(capabilities.get("verification_status") or "pending")
    acct.capabilities_status = "enabled" if can_receive_settlements else "pending"
    acct.capabilities_json = {
        "profile": combined_profile,
        "capabilities": capabilities,
        "masked_destination": masked_destination,
    }
    acct.onboarding_state = "verified" if can_receive_settlements else "pending_verification"


def sync_connect_account_from_oauth_code(db: Session, *, mentor_id: str, code: str) -> CoachConnectAccount:
    acct = get_or_create_connect_account(db, mentor_id)
    token_payload = exchange_connect_code_for_token(code)
    _save_connect_token_payload(acct, token_payload)

    access = acct.connect_access_token or ""
    combined = fetch_connected_account_profile(access)
    capabilities = fetch_connected_account_capabilities(access)
    masked_destination = fetch_masked_payout_destination(access)
    _apply_fetched_connect_data(acct, combined, capabilities, masked_destination)
    acct.last_synced_at = _utcnow()
    acct.updated_at = _utcnow()
    db.flush()
    return acct


def refresh_connect_account_status(db: Session, *, mentor_id: str) -> tuple[CoachConnectAccount, Decimal | None, str | None]:
    """
    Re-fetch Mollie Connect profile/onboarding and optional settlement balance (balances.read).
    Returns (account, settlement_available_decimal_or_none, balance_note_if_unavailable).
    """
    acct = get_or_create_connect_account(db, mentor_id)
    if not acct.connect_refresh_token and not acct.connect_access_token:
        return acct, None, "not_connected"
    access = get_valid_connect_access_token(db, acct)
    combined = fetch_connected_account_profile(access)
    capabilities = fetch_connected_account_capabilities(access)
    masked_destination = fetch_masked_payout_destination(access)
    _apply_fetched_connect_data(acct, combined, capabilities, masked_destination)
    ccy = (settings.payment_currency or "EUR").strip().upper()
    settlement, bal_err = fetch_connect_settlement_available(access, ccy)
    note = bal_err if settlement is None and bal_err else None
    acct.last_synced_at = _utcnow()
    acct.updated_at = _utcnow()
    db.flush()
    return acct, settlement, note


def mollie_onboarding_dashboard_url_for_account(acct: CoachConnectAccount) -> str | None:
    """
    URL to Mollie's hosted onboarding (bank account, verification) from last /onboarding/me sync.
    See Mollie API: _links.dashboard.href on onboarding status.
    """
    cj = acct.capabilities_json
    if not isinstance(cj, dict):
        return None
    caps = cj.get("capabilities") or {}
    if not isinstance(caps, dict):
        return None
    href = caps.get("dashboard_href")
    if href:
        s = str(href).strip()
        return s or None
    inner = caps.get("onboarding") or {}
    if isinstance(inner, dict):
        links = inner.get("_links") or {}
        if isinstance(links, dict):
            d = links.get("dashboard")
            if isinstance(d, dict) and d.get("href"):
                s = str(d.get("href")).strip()
                return s or None
    return None


def connect_payout_gate_status(db: Session, mentor_id: str) -> tuple[bool, str | None]:
    """
    DB-only check for admin UI / pre-validation. Does not call Mollie.
    Actual payout may still fail if tokens are revoked server-side (handled at execution).
    """
    acct = db.query(CoachConnectAccount).filter(CoachConnectAccount.mentor_id == mentor_id).first()
    if not acct:
        return False, "Coach has not started Mollie Connect."
    if not acct.connect_access_token and not acct.connect_refresh_token:
        return False, "Coach must complete Mollie Connect OAuth."
    if not acct.payouts_enabled:
        return False, "Coach must finish Mollie onboarding and add a payout bank account in Mollie."
    return True, None


def resolve_connect_access_token_for_payout(db: Session, mentor_id: str) -> tuple[CoachConnectAccount, str]:
    ok, reason = connect_payout_gate_status(db, mentor_id)
    if not ok:
        raise MarketplaceError(reason or "Coach is not ready for Mollie payout")
    acct = db.query(CoachConnectAccount).filter(CoachConnectAccount.mentor_id == mentor_id).first()
    assert acct is not None
    token = get_valid_connect_access_token(db, acct)
    return acct, token


def get_valid_connect_access_token(db: Session, acct: CoachConnectAccount) -> str:
    now = _utcnow()
    expires_at = _to_utc(acct.connect_token_expires_at)
    if acct.connect_access_token and (expires_at is None or expires_at > now + timedelta(seconds=60)):
        return acct.connect_access_token
    if not acct.connect_refresh_token:
        raise MarketplaceError("Missing connect refresh token; reconnect Mollie account")
    try:
        token_payload = refresh_connect_token(acct.connect_refresh_token)
    except MollieServiceError as exc:
        raise MarketplaceError(str(exc)) from exc
    _save_connect_token_payload(acct, token_payload)
    acct.updated_at = _utcnow()
    db.flush()
    if not acct.connect_access_token:
        raise MarketplaceError("Unable to refresh connect access token")
    return acct.connect_access_token


def _webhook_payload_hash(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def record_webhook_event(
    db: Session,
    *,
    provider: str,
    event_key: str,
    event_type: str | None,
    payload: bytes,
    signature_valid: bool,
) -> WebhookEventLog:
    row = (
        db.query(WebhookEventLog)
        .filter(WebhookEventLog.provider == provider, WebhookEventLog.event_key == event_key)
        .first()
    )
    if row:
        return row
    payload_json = None
    try:
        payload_json = json.loads(payload.decode("utf-8") or "{}")
    except Exception:
        payload_json = None
    row = WebhookEventLog(
        id=new_uuid(),
        provider=provider,
        event_key=event_key,
        event_type=event_type,
        signature_valid=signature_valid,
        payload_hash=_webhook_payload_hash(payload),
        payload_json=payload_json,
        processing_status="received",
        error_message=None,
        received_at=_utcnow(),
        processed_at=None,
    )
    db.add(row)
    db.flush()
    return row


def verify_generic_hmac_signature(*, secret: str, payload: bytes, signature: str | None) -> bool:
    if not secret:
        return str(settings.environment).strip().lower() != "production"
    if not signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


def request_coach_payout(
    db: Session,
    *,
    mentor_id: str,
    amount: Decimal,
    currency: str,
    idempotency_key: str | None,
) -> CoachPayoutRequest:
    amt = q2(amount)
    if amt < q2(settings.marketplace_min_withdrawal_amount):
        raise MarketplaceError(f"Minimum withdrawal is {q2(settings.marketplace_min_withdrawal_amount)} {currency.upper()}")
    acct = get_or_create_connect_account(db, mentor_id)
    if not acct.payouts_enabled:
        raise MarketplaceError("Coach payouts are not enabled yet")
    withdrawable = get_or_create_wallet_account(
        db,
        owner_type=OWNER_COACH,
        owner_id=mentor_id,
        account_kind=ACCOUNT_COACH_WITHDRAWABLE,
        currency=currency,
    )
    balance = get_account_balance(db, withdrawable.id)
    if balance < amt:
        raise MarketplaceError("Insufficient withdrawable balance")
    if idempotency_key:
        existing = db.query(CoachPayoutRequest).filter(CoachPayoutRequest.idempotency_key == idempotency_key).first()
        if existing:
            return existing
    req = CoachPayoutRequest(
        id=new_uuid(),
        mentor_id=mentor_id,
        currency=currency.upper(),
        amount=amt,
        status="requested",
        requested_at=_utcnow(),
        approved_by_admin_id=None,
        processed_at=None,
        failure_reason=None,
        idempotency_key=idempotency_key,
    )
    db.add(req)
    db.flush()
    return req


def execute_payout_attempt(db: Session, payout: CoachPayoutRequest) -> CoachPayoutAttempt:
    acct = get_or_create_connect_account(db, payout.mentor_id)
    if not acct.provider_account_id:
        raise MarketplaceError("Missing provider payout account reference")
    attempt_count = db.query(CoachPayoutAttempt).filter(CoachPayoutAttempt.payout_request_id == payout.id).count()
    attempt = CoachPayoutAttempt(
        id=new_uuid(),
        payout_request_id=payout.id,
        attempt_no=attempt_count + 1,
        provider_ref=None,
        status="processing",
        error_message=None,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(attempt)
    db.flush()
    try:
        access_token = get_valid_connect_access_token(db, acct)
        avail, _bal_err = fetch_connect_settlement_available(access_token, payout.currency)
        if avail is not None and q2(avail) < q2(payout.amount):
            raise MarketplaceError(
                "Mollie settlement balance is lower than this payout. In-app earnings and the coach's Mollie balance "
                "can differ until customer pay-ins are routed or transferred to this connected account. "
                f"(Mollie available: {avail} {payout.currency}; payout: {payout.amount} {payout.currency})"
            )
        result = payout_gateway.create_payout(
            mentor_account_ref=acct.provider_account_id,
            amount=str(q2(payout.amount)),
            currency=payout.currency,
            reference=f"coach_withdrawal_{payout.id}",
            access_token=access_token,
        )
        attempt.provider_ref = result.provider_ref
        attempt.status = result.status
        if result.status == "paid":
            payout.status = "paid"
        elif result.status == "processing":
            payout.status = "processing"
        else:
            payout.status = "failed"
        payout.processed_at = result.processed_at
        payout.failure_reason = None if result.status in ("paid", "processing") else f"Payout status {result.status}"
        if result.status == "paid":
            try:
                settle_coach_payout_to_platform_cash(
                    db,
                    mentor_id=payout.mentor_id,
                    payout_request_id=payout.id,
                    currency=payout.currency,
                    amount=Decimal(str(payout.amount)),
                )
            except LedgerError as ledger_exc:
                # Keep external payout status visible, but mark reconciliation issue for follow-up.
                attempt.error_message = f"Payout sent, ledger settlement failed: {ledger_exc}"
                payout.failure_reason = f"Ledger settlement failed: {ledger_exc}"
    except Exception as exc:
        attempt.status = "failed"
        attempt.error_message = str(exc)
        payout.status = "failed"
        payout.failure_reason = str(exc)
    attempt.updated_at = _utcnow()
    return attempt
