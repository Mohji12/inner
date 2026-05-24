from __future__ import annotations

import base64
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from fastapi.responses import RedirectResponse

from api.deps import AnyActorDep, CurrentAdmin, CurrentMentor, DbSession
from core.config import settings
from core.security import new_uuid
from models.mentor import Mentor
from models.marketplace import CapabilityMatrix, CoachConnectAccount, CoachPayoutRequest, CommissionConfig, WalletHold
from services.ledger_service import (
    ACCOUNT_COACH_PENDING,
    ACCOUNT_COACH_WITHDRAWABLE,
    ACCOUNT_USER_AVAILABLE,
    OWNER_COACH,
    OWNER_USER,
    LedgerError,
    get_account_balance,
    get_or_create_commission_config,
    get_or_create_wallet_account,
    move_coach_pending_to_withdrawable,
    q2,
)
from services.marketplace_service import (
    MarketplaceError,
    audit_log,
    complete_connect_callback,
    execute_payout_attempt,
    mollie_onboarding_dashboard_url_for_account,
    refresh_connect_account_status,
    request_coach_payout,
    sync_connect_account_from_oauth_code,
    start_connect_onboarding,
    upsert_capability,
)
from services.session_billing_service import (
    SessionBillingError,
    finalize_session_billing,
    process_session_heartbeat,
    reserve_for_session_start,
)

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CapabilityUpsertIn(BaseModel):
    country_code: str = Field(min_length=2, max_length=2)
    entity_type: str = Field(min_length=2, max_length=32)
    currency: str = Field(default="EUR", min_length=3, max_length=8)
    supports_connect: bool
    supports_payouts: bool
    supports_transfers: bool
    notes: str | None = None


class CapabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    country_code: str
    entity_type: str
    currency: str
    supports_connect: bool
    supports_payouts: bool
    supports_transfers: bool
    notes: str | None
    is_active: bool
    updated_at: datetime


class CommissionUpdateIn(BaseModel):
    percent: Decimal = Field(gt=Decimal("0"), le=Decimal("100"))
    currency: str = Field(default="EUR", min_length=3, max_length=8)
    effective_from: datetime | None = None


class CommissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    percent: Decimal
    currency: str
    effective_from: datetime
    effective_to: datetime | None
    is_active: bool


class ReserveSessionIn(BaseModel):
    session_id: str
    reserve_amount: Decimal = Field(gt=Decimal("0"))
    currency: str = Field(default="EUR", min_length=3, max_length=8)


class HoldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    user_id: str
    amount_reserved: Decimal
    amount_consumed: Decimal
    status: str
    currency: str
    created_at: datetime


class SessionHeartbeatIn(BaseModel):
    session_id: str


class SessionHeartbeatOut(BaseModel):
    status: str
    remaining_hold: str | None = None


class PayoutRequestIn(BaseModel):
    amount: Decimal = Field(gt=Decimal("0"))
    currency: str = Field(default="EUR", min_length=3, max_length=8)
    idempotency_key: str | None = None


class PayoutRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mentor_id: str
    amount: Decimal
    currency: str
    status: str
    requested_at: datetime
    processed_at: datetime | None = None
    failure_reason: str | None = None


class ConnectStartOut(BaseModel):
    onboarding_state: str
    onboarding_url: str


class ConnectCallbackIn(BaseModel):
    provider_account_id: str | None = None
    kyc_status: str = "pending"
    payouts_enabled: bool = False
    capabilities: dict | None = None


class WalletBalanceOut(BaseModel):
    currency: str
    available_balance: Decimal
    pending_balance: Decimal | None = None
    withdrawable_balance: Decimal | None = None


class ConnectStatusOut(BaseModel):
    mentor_id: str
    onboarding_state: str
    kyc_status: str
    payouts_enabled: bool
    provider_account_id: str | None = None
    provider_account_label: str | None = None
    provider_account_masked: str | None = None
    capabilities_status: str | None = None
    #: Direct link to complete onboarding (bank account, verification) in Mollie; from GET /v2/onboarding/me _links.dashboard.
    mollie_onboarding_dashboard_url: str | None = None
    #: Mollie Balances API (requires balances.read); set by POST /connect/refresh.
    mollie_settlement_available: Decimal | None = None
    mollie_balance_note: str | None = None


@router.get("/commission/current", response_model=CommissionOut)
def admin_get_current_commission(
    db: DbSession,
    _admin: CurrentAdmin,
    currency: str = Query("EUR"),
) -> CommissionOut:
    row = get_or_create_commission_config(db, currency=currency.upper())
    return CommissionOut.model_validate(row)


@router.get("/capabilities", response_model=list[CapabilityOut])
def list_capabilities(
    db: DbSession,
    _admin: CurrentAdmin,
) -> list[CapabilityOut]:
    rows = db.query(CapabilityMatrix).order_by(CapabilityMatrix.updated_at.desc()).all()
    return [CapabilityOut.model_validate(r) for r in rows]


@router.post("/capabilities", response_model=CapabilityOut)
def admin_upsert_capability(
    payload: CapabilityUpsertIn,
    db: DbSession,
    admin: CurrentAdmin,
) -> CapabilityOut:
    row = upsert_capability(
        db,
        country_code=payload.country_code,
        entity_type=payload.entity_type,
        currency=payload.currency,
        supports_connect=payload.supports_connect,
        supports_payouts=payload.supports_payouts,
        supports_transfers=payload.supports_transfers,
        notes=payload.notes,
    )
    audit_log(
        db,
        actor_role="admin",
        actor_id=admin.id,
        action="capability.upsert",
        entity_type="capability_matrix",
        entity_id=row.id,
        details=payload.model_dump(),
    )
    db.commit()
    return CapabilityOut.model_validate(row)


@router.post("/commission", response_model=CommissionOut)
def admin_update_commission(
    payload: CommissionUpdateIn,
    db: DbSession,
    admin: CurrentAdmin,
) -> CommissionOut:
    now = _utcnow()
    prev = get_or_create_commission_config(db, currency=payload.currency.upper())
    prev.is_active = False
    prev.effective_to = payload.effective_from or now
    new_row = CommissionConfig(
        id=new_uuid(),
        scope="global",
        scope_ref=None,
        country_code=None,
        currency=payload.currency.upper(),
        percent=q2(payload.percent),
        is_active=True,
        effective_from=payload.effective_from or now,
        effective_to=None,
        created_by_admin=admin.id,
        created_at=now,
    )
    db.add(new_row)
    audit_log(
        db,
        actor_role="admin",
        actor_id=admin.id,
        action="commission.update",
        entity_type="commission_config",
        entity_id=new_row.id,
        details={"percent": str(new_row.percent), "currency": new_row.currency},
    )
    db.commit()
    return CommissionOut.model_validate(new_row)


@router.post("/sessions/reserve", response_model=HoldOut)
def reserve_session_hold(
    payload: ReserveSessionIn,
    actor: AnyActorDep,
    db: DbSession,
) -> HoldOut:
    if actor.role != "user":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only users can reserve holds")
    try:
        hold = reserve_for_session_start(
            db,
            session_id=payload.session_id,
            reserve_amount=payload.reserve_amount,
            currency=payload.currency.upper(),
        )
    except (SessionBillingError, LedgerError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.commit()
    return HoldOut.model_validate(hold)


@router.post("/sessions/heartbeat", response_model=SessionHeartbeatOut)
def billing_heartbeat(
    payload: SessionHeartbeatIn,
    actor: AnyActorDep,
    db: DbSession,
) -> SessionHeartbeatOut:
    if actor.role not in ("user", "mentor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid role")
    try:
        out = process_session_heartbeat(db, session_id=payload.session_id)
    except SessionBillingError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.commit()
    return SessionHeartbeatOut(status=str(out.get("status")), remaining_hold=out.get("remaining_hold"))


@router.post("/sessions/{session_id}/finalize")
def finalize_session(
    session_id: str,
    actor: AnyActorDep,
    db: DbSession,
) -> dict:
    if actor.role not in ("user", "mentor", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid role")
    try:
        out = finalize_session_billing(db, session_id=session_id)
    except SessionBillingError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.commit()
    return out


@router.get("/wallet/me", response_model=WalletBalanceOut)
def get_my_marketplace_wallet(
    actor: AnyActorDep,
    db: DbSession,
    currency: str = Query("EUR"),
) -> WalletBalanceOut:
    ccy = currency.upper()
    if actor.role == "user":
        available = get_or_create_wallet_account(
            db,
            owner_type=OWNER_USER,
            owner_id=actor.subject_id,
            account_kind=ACCOUNT_USER_AVAILABLE,
            currency=ccy,
        )
        return WalletBalanceOut(
            currency=ccy,
            available_balance=get_account_balance(db, available.id),
            pending_balance=None,
            withdrawable_balance=None,
        )
    if actor.role == "mentor":
        pending = get_or_create_wallet_account(
            db,
            owner_type=OWNER_COACH,
            owner_id=actor.subject_id,
            account_kind=ACCOUNT_COACH_PENDING,
            currency=ccy,
        )
        withdrawable = get_or_create_wallet_account(
            db,
            owner_type=OWNER_COACH,
            owner_id=actor.subject_id,
            account_kind=ACCOUNT_COACH_WITHDRAWABLE,
            currency=ccy,
        )
        return WalletBalanceOut(
            currency=ccy,
            available_balance=get_account_balance(db, pending.id) + get_account_balance(db, withdrawable.id),
            pending_balance=get_account_balance(db, pending.id),
            withdrawable_balance=get_account_balance(db, withdrawable.id),
        )
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins have no marketplace wallet")


@router.post("/connect/start", response_model=ConnectStartOut)
def mentor_start_connect_onboarding(
    db: DbSession,
    mentor: CurrentMentor,
    request: Request,
) -> ConnectStartOut:
    frontend_base_url = (request.headers.get("origin") or "").strip()
    try:
        acct, url = start_connect_onboarding(
            db,
            mentor_id=mentor.id,
            frontend_base_url=frontend_base_url,
        )
    except MarketplaceError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    audit_log(
        db,
        actor_role="mentor",
        actor_id=mentor.id,
        action="connect.onboarding.start",
        entity_type="coach_connect_account",
        entity_id=acct.id,
        details={"mentor_id": mentor.id},
    )
    db.commit()
    return ConnectStartOut(onboarding_state=acct.onboarding_state, onboarding_url=url)


@router.get("/connect/status", response_model=ConnectStatusOut)
def mentor_connect_status(
    db: DbSession,
    mentor: CurrentMentor,
) -> ConnectStatusOut:
    acct = db.query(CoachConnectAccount).filter(CoachConnectAccount.mentor_id == mentor.id).first()
    if not acct:
        return ConnectStatusOut(
            mentor_id=mentor.id,
            onboarding_state="not_started",
            kyc_status="pending",
            payouts_enabled=False,
            provider_account_id=None,
            provider_account_label=None,
            provider_account_masked=None,
            capabilities_status=None,
            mollie_onboarding_dashboard_url=None,
            mollie_settlement_available=None,
            mollie_balance_note=None,
        )
    return ConnectStatusOut(
        mentor_id=mentor.id,
        onboarding_state=acct.onboarding_state,
        kyc_status=acct.kyc_status,
        payouts_enabled=acct.payouts_enabled,
        provider_account_id=acct.provider_account_id,
        provider_account_label=acct.provider_account_label,
        provider_account_masked=acct.provider_account_masked,
        capabilities_status=acct.capabilities_status,
        mollie_onboarding_dashboard_url=mollie_onboarding_dashboard_url_for_account(acct),
        mollie_settlement_available=None,
        mollie_balance_note=None,
    )


@router.post("/connect/refresh", response_model=ConnectStatusOut)
def mentor_refresh_connect_status(
    db: DbSession,
    mentor: CurrentMentor,
) -> ConnectStatusOut:
    try:
        acct, settlement, bal_note = refresh_connect_account_status(db, mentor_id=mentor.id)
    except MarketplaceError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    audit_log(
        db,
        actor_role="mentor",
        actor_id=mentor.id,
        action="connect.status.refresh",
        entity_type="coach_connect_account",
        entity_id=acct.id,
        details={"mentor_id": mentor.id},
    )
    db.commit()
    return ConnectStatusOut(
        mentor_id=mentor.id,
        onboarding_state=acct.onboarding_state,
        kyc_status=acct.kyc_status,
        payouts_enabled=acct.payouts_enabled,
        provider_account_id=acct.provider_account_id,
        provider_account_label=acct.provider_account_label,
        provider_account_masked=acct.provider_account_masked,
        capabilities_status=acct.capabilities_status,
        mollie_onboarding_dashboard_url=mollie_onboarding_dashboard_url_for_account(acct),
        mollie_settlement_available=settlement,
        mollie_balance_note=bal_note,
    )


@router.post("/connect/callback")
def mentor_complete_connect_callback(
    payload: ConnectCallbackIn,
    db: DbSession,
    mentor: CurrentMentor,
) -> dict:
    acct = complete_connect_callback(
        db,
        mentor_id=mentor.id,
        provider_account_id=payload.provider_account_id,
        kyc_status=payload.kyc_status,
        payouts_enabled=payload.payouts_enabled,
        capabilities=payload.capabilities,
    )
    audit_log(
        db,
        actor_role="mentor",
        actor_id=mentor.id,
        action="connect.onboarding.callback",
        entity_type="coach_connect_account",
        entity_id=acct.id,
        details={"kyc_status": acct.kyc_status, "payouts_enabled": acct.payouts_enabled},
    )
    db.commit()
    return {
        "mentor_id": mentor.id,
        "onboarding_state": acct.onboarding_state,
        "kyc_status": acct.kyc_status,
        "payouts_enabled": acct.payouts_enabled,
    }


@router.get("/connect/callback")
def mollie_connect_callback_redirect(
    db: DbSession,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
) -> RedirectResponse:
    """
    Public OAuth callback target for Mollie Connect.
    Mollie redirects browser here without Authorization header, so this endpoint must not
    depend on mentor auth. We derive mentor_id from state set during `/connect/start`.
    """
    if not state:
        base_frontend = (settings.mollie_redirect_base_url or "").rstrip("/") or "http://localhost:8080"
        default_redirect = f"{base_frontend}/mentor/payouts?connect=failed"
        return RedirectResponse(url=f"{default_redirect}&reason=missing_state", status_code=302)

    state_parts = state.split(":", 2)
    mentor_id = state_parts[0].strip()
    frontend_from_state = ""
    if len(state_parts) == 3 and state_parts[2].strip():
        try:
            frontend_from_state = base64.urlsafe_b64decode(state_parts[2].encode("ascii")).decode("utf-8").strip()
        except Exception:
            frontend_from_state = ""

    base_frontend = (frontend_from_state or settings.mollie_redirect_base_url or "").rstrip("/") or "http://localhost:8080"
    default_redirect = f"{base_frontend}/mentor/payouts?connect=failed"

    if not mentor_id:
        return RedirectResponse(url=f"{default_redirect}&reason=invalid_state", status_code=302)
    mentor_exists = db.query(Mentor.id).filter(Mentor.id == mentor_id).first() is not None
    if not mentor_exists:
        return RedirectResponse(url=f"{default_redirect}&reason=invalid_mentor", status_code=302)

    if error:
        try:
            acct = complete_connect_callback(
                db,
                mentor_id=mentor_id,
                provider_account_id=None,
                kyc_status="pending",
                payouts_enabled=False,
                capabilities={"oauth_error": error},
            )
            audit_log(
                db,
                actor_role="system",
                actor_id="system",
                action="connect.oauth.error",
                entity_type="coach_connect_account",
                entity_id=acct.id,
                details={"mentor_id": mentor_id, "error": error},
            )
            db.commit()
        except Exception:
            db.rollback()
        return RedirectResponse(url=f"{default_redirect}&reason=oauth_error", status_code=302)

    if not code:
        return RedirectResponse(url=f"{default_redirect}&reason=missing_code", status_code=302)

    try:
        acct = sync_connect_account_from_oauth_code(db, mentor_id=mentor_id, code=code)
        audit_log(
            db,
            actor_role="system",
            actor_id="system",
            action="connect.oauth.callback",
            entity_type="coach_connect_account",
            entity_id=acct.id,
            details={
                "mentor_id": mentor_id,
                "oauth_code_received": True,
                "payouts_enabled": acct.payouts_enabled,
                "provider_account_id": acct.provider_account_id,
                "capabilities_status": acct.capabilities_status,
            },
        )
        db.commit()
    except MarketplaceError:
        db.rollback()
        return RedirectResponse(url=f"{default_redirect}&reason=token_sync_failed", status_code=302)
    except Exception:
        db.rollback()
        return RedirectResponse(url=f"{default_redirect}&reason=callback_write_failed", status_code=302)
    return RedirectResponse(url=f"{base_frontend}/mentor/payouts?connect=success", status_code=302)


@router.get("/payouts", response_model=list[PayoutRequestOut])
def list_payout_requests(
    db: DbSession,
    actor: AnyActorDep,
    status_filter: str | None = Query(None, alias="status"),
) -> list[PayoutRequestOut]:
    q = db.query(CoachPayoutRequest)
    if actor.role == "mentor":
        q = q.filter(CoachPayoutRequest.mentor_id == actor.subject_id)
    elif actor.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admin or mentor can view payout requests")
    if status_filter:
        q = q.filter(CoachPayoutRequest.status == status_filter.strip())
    rows = q.order_by(CoachPayoutRequest.requested_at.desc()).all()
    return [PayoutRequestOut.model_validate(r) for r in rows]


@router.post("/payouts/request", response_model=PayoutRequestOut)
def coach_request_payout(
    payload: PayoutRequestIn,
    db: DbSession,
    mentor: CurrentMentor,
) -> PayoutRequestOut:
    try:
        req = request_coach_payout(
            db,
            mentor_id=mentor.id,
            amount=payload.amount,
            currency=payload.currency.upper(),
            idempotency_key=payload.idempotency_key,
        )
    except MarketplaceError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    audit_log(
        db,
        actor_role="mentor",
        actor_id=mentor.id,
        action="coach.payout.requested",
        entity_type="coach_payout_request",
        entity_id=req.id,
        details={"amount": str(req.amount), "currency": req.currency},
    )
    db.commit()
    return PayoutRequestOut.model_validate(req)


@router.post("/payouts/{payout_id}/approve", response_model=PayoutRequestOut)
def admin_approve_payout(
    payout_id: str,
    db: DbSession,
    admin: CurrentAdmin,
) -> PayoutRequestOut:
    req = db.query(CoachPayoutRequest).filter(CoachPayoutRequest.id == payout_id).with_for_update().first()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payout request not found")
    if req.status not in ("requested", "failed"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payout request is not approvable")
    req.status = "approved"
    req.approved_by_admin_id = admin.id
    req.processed_at = None
    req.failure_reason = None
    audit_log(
        db,
        actor_role="admin",
        actor_id=admin.id,
        action="coach.payout.approved",
        entity_type="coach_payout_request",
        entity_id=req.id,
        details=None,
    )
    db.commit()
    return PayoutRequestOut.model_validate(req)


@router.post("/payouts/{payout_id}/execute", response_model=PayoutRequestOut)
def admin_execute_payout(
    payout_id: str,
    db: DbSession,
    admin: CurrentAdmin,
) -> PayoutRequestOut:
    req = db.query(CoachPayoutRequest).filter(CoachPayoutRequest.id == payout_id).with_for_update().first()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payout request not found")
    if req.status not in ("approved", "failed"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payout request must be approved or failed")
    _attempt = execute_payout_attempt(db, req)
    audit_log(
        db,
        actor_role="admin",
        actor_id=admin.id,
        action="coach.payout.executed",
        entity_type="coach_payout_request",
        entity_id=req.id,
        details={"status": req.status},
    )
    db.commit()
    return PayoutRequestOut.model_validate(req)


@router.post("/coaches/{mentor_id}/release-pending")
def admin_release_pending_to_withdrawable(
    mentor_id: str,
    db: DbSession,
    admin: CurrentAdmin,
    amount: Decimal = Query(..., gt=Decimal("0")),
    currency: str = Query("EUR"),
) -> dict:
    _ = move_coach_pending_to_withdrawable(
        db,
        mentor_id=mentor_id,
        currency=currency.upper(),
        amount=amount,
    )
    audit_log(
        db,
        actor_role="admin",
        actor_id=admin.id,
        action="coach.pending.released",
        entity_type="coach",
        entity_id=mentor_id,
        details={"amount": str(q2(amount)), "currency": currency.upper()},
    )
    db.commit()
    return {"mentor_id": mentor_id, "released_amount": str(q2(amount)), "currency": currency.upper()}
