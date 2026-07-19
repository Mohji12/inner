from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings
from core.security import new_uuid
from models.mentor import Mentor
from models.mentor_onboarding_payment import MentorOnboardingPayment
from services.fx_checkout import FxCheckoutError, FxUpstreamError, eur_to_checkout_amount
from services.mollie_service import MollieServiceError, create_mollie_payment
from services.promo_service import PromoError, apply_promo_code, calculate_discount, validate_promo_code

PaymentPlan = Literal["full", "installments"]
PAID_STATUSES = ("paid",)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _q(amount: Decimal) -> Decimal:
    return Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def onboarding_installment_total() -> int:
    return max(1, int(settings.mentor_onboarding_installment_count))


def onboarding_amount_eur(*, payment_plan: PaymentPlan, installment_number: int) -> Decimal:
    total = _q(settings.mentor_onboarding_charge_eur)
    if payment_plan == "full":
        return total
    per = _q(settings.mentor_onboarding_installment_charge_eur)
    total_parts = onboarding_installment_total()
    if installment_number < 1 or installment_number > total_parts:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid installment number")
    if installment_number == total_parts:
        prior = per * Decimal(total_parts - 1)
        return _q(total - prior)
    return per


def onboarding_fee_is_free() -> bool:
    return _q(settings.mentor_onboarding_charge_eur) <= Decimal("0.00")


def onboarding_plans_public() -> dict[str, str | int | bool]:
    total = _q(settings.mentor_onboarding_charge_eur)
    per = _q(settings.mentor_onboarding_installment_charge_eur)
    parts = onboarding_installment_total()
    is_free = onboarding_fee_is_free()
    return {
        "total_eur": str(total),
        "full_eur": str(total),
        "installment_eur": str(per),
        "installment_count": parts,
        "is_free": is_free,
    }


def _parse_row_plan(row: MentorOnboardingPayment) -> tuple[str, int, int]:
    plan = getattr(row, "payment_plan", None) or "full"
    inst = int(getattr(row, "installment_number", None) or 1)
    total = int(getattr(row, "installment_total", None) or 1)
    if row.metadata_json:
        try:
            meta = json.loads(row.metadata_json)
            plan = str(meta.get("payment_plan") or plan)
            inst = int(meta.get("installment_number") or inst)
            total = int(meta.get("installment_total") or total)
        except (TypeError, ValueError, json.JSONDecodeError):
            pass
    return plan, inst, total


def paid_onboarding_rows(db: Session, mentor_id: str) -> list[MentorOnboardingPayment]:
    return (
        db.query(MentorOnboardingPayment)
        .filter(
            MentorOnboardingPayment.mentor_id == mentor_id,
            MentorOnboardingPayment.status.in_(PAID_STATUSES),
        )
        .order_by(MentorOnboardingPayment.created_at.asc())
        .all()
    )


def mentor_onboarding_is_complete(db: Session, mentor_id: str) -> bool:
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if mentor and mentor.email_verified and mentor.is_approved and mentor.status == "active":
        return True
    paid = paid_onboarding_rows(db, mentor_id)
    if not paid:
        return False
    for row in paid:
        plan, inst, total = _parse_row_plan(row)
        if plan == "full" or total <= 1:
            return True
    paid_nums = { _parse_row_plan(r)[1] for r in paid if _parse_row_plan(r)[0] == "installments" }
    return paid_nums >= set(range(1, onboarding_installment_total() + 1))


def mentor_onboarding_status(db: Session, mentor_id: str) -> dict:
    complete = mentor_onboarding_is_complete(db, mentor_id)
    if complete or onboarding_fee_is_free():
        return {
            "is_complete": complete,
            "payment_plan": "full" if complete else None,
            "installments_paid": 1 if complete else 0,
            "installment_total": 1,
            "next_installment_number": None,
            "next_amount_eur": None,
        }
    paid_rows = paid_onboarding_rows(db, mentor_id)
    plan: str | None = None
    installment_total = 1
    paid_installments: set[int] = set()

    for row in paid_rows:
        p, inst, total = _parse_row_plan(row)
        plan = plan or p
        installment_total = max(installment_total, total)
        if p == "installments":
            paid_installments.add(inst)

    next_installment: int | None = None
    if not complete and plan == "installments":
        for n in range(1, onboarding_installment_total() + 1):
            if n not in paid_installments:
                next_installment = n
                break
    elif not complete and not paid_rows:
        next_installment = 1

    next_amount_eur: str | None = None
    if next_installment is not None:
        use_plan: PaymentPlan = "installments" if plan == "installments" or (not paid_rows) else "full"
        if not paid_rows:
            use_plan = plan or "full"
        if complete:
            next_amount_eur = None
        elif use_plan == "full" or (not paid_rows and plan is None):
            next_amount_eur = str(onboarding_amount_eur(payment_plan="full", installment_number=1))
        else:
            next_amount_eur = str(
                onboarding_amount_eur(payment_plan="installments", installment_number=next_installment)
            )

    return {
        "is_complete": complete,
        "payment_plan": plan,
        "installments_paid": len(paid_installments) if plan == "installments" else (1 if complete else 0),
        "installment_total": installment_total if plan == "installments" else 1,
        "next_installment_number": next_installment,
        "next_amount_eur": next_amount_eur,
    }


def mentor_may_sign_in(mentor: Mentor, db: Session) -> bool:
    if mentor.status == "rejected":
        return False
    if not mentor.email_verified:
        return False
    if mentor.is_approved and mentor.status == "active":
        return True
    return mentor_onboarding_is_complete(db, mentor.id) or bool(
        db.query(MentorOnboardingPayment.id)
        .filter(MentorOnboardingPayment.mentor_id == mentor.id)
        .first()
    )


def _sign_in_block_message(mentor: Mentor, db: Session) -> str:
    if mentor.status == "rejected":
        return "Your coach account was rejected. Please contact support."
    if not mentor.email_verified:
        return "Please verify your email before signing in"
    status = mentor_onboarding_status(db, mentor.id)
    if status["next_installment_number"]:
        return "Complete your onboarding payment to access your coach account."
    return "Your coach account is pending onboarding payment."


def ensure_mentor_can_sign_in(mentor: Mentor, db: Session) -> None:
    if mentor.is_approved and mentor.status == "active":
        return
    if mentor_may_sign_in(mentor, db):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, _sign_in_block_message(mentor, db))


def _validate_installment_order(db: Session, mentor_id: str, payment_plan: PaymentPlan, installment_number: int) -> None:
    if payment_plan == "full":
        if installment_number != 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Full payment uses a single installment")
        if paid_onboarding_rows(db, mentor_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Onboarding payment already started or completed")
        return

    total_parts = onboarding_installment_total()
    if installment_number < 1 or installment_number > total_parts:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid installment number")

    paid = paid_onboarding_rows(db, mentor_id)
    paid_nums = { _parse_row_plan(r)[1] for r in paid if _parse_row_plan(r)[0] == "installments" }
    if installment_number in paid_nums:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Installment {installment_number} is already paid")

    if installment_number > 1 and (installment_number - 1) not in paid_nums:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pay the previous installment first")

    for row in paid:
        plan, _, _ = _parse_row_plan(row)
        if plan == "full":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Onboarding already paid in full")


def _find_reusable_open(
    db: Session,
    *,
    mentor_id: str,
    checkout_currency: str,
    payment_plan: PaymentPlan,
    installment_number: int,
) -> MentorOnboardingPayment | None:
    rows = (
        db.query(MentorOnboardingPayment)
        .filter(
            MentorOnboardingPayment.mentor_id == mentor_id,
            MentorOnboardingPayment.status.in_(["open", "pending"]),
        )
        .order_by(MentorOnboardingPayment.created_at.desc())
        .all()
    )
    ccy = checkout_currency.upper()
    for row in rows:
        if not row.checkout_url:
            continue
        if (row.currency or "").strip().upper() != ccy:
            continue
        plan, inst, _ = _parse_row_plan(row)
        if plan == payment_plan and inst == installment_number:
            return row
    return None


def create_onboarding_checkout(
    db: Session,
    *,
    mentor: Mentor,
    payment_plan: PaymentPlan,
    installment_number: int,
    checkout_currency: str,
    redirect_url: str,
    webhook_url: str | None,
    promo_code: str | None = None,
) -> MentorOnboardingPayment:
    if not mentor.email_verified:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verify email before payment")
    if mentor.is_approved and mentor.status == "active":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Coach already approved")
    if mentor_onboarding_is_complete(db, mentor.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Onboarding payment already completed")

    ccy_req = (checkout_currency or "EUR").strip().upper()
    _validate_installment_order(db, mentor.id, payment_plan, installment_number)

    existing = _find_reusable_open(
        db,
        mentor_id=mentor.id,
        checkout_currency=ccy_req,
        payment_plan=payment_plan,
        installment_number=installment_number,
    )
    if existing:
        return existing

    installment_total = 1 if payment_plan == "full" else onboarding_installment_total()
    amount_eur = onboarding_amount_eur(payment_plan=payment_plan, installment_number=installment_number)

    normalized_promo = (promo_code or "").strip().upper() or None
    discount_eur = Decimal("0.00")
    if normalized_promo:
        try:
            promo_row = validate_promo_code(
                db,
                normalized_promo,
                amount_eur,
                user_id=None,
                mentor_id=None,
                scope="onboarding",
            )
            discount_eur = calculate_discount(promo_row, amount_eur)
        except PromoError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    final_eur = _q(max(Decimal("0.00"), amount_eur - discount_eur))

    if final_eur <= Decimal("0.00"):
        return _create_onboarding_promo_waiver(
            db,
            mentor=mentor,
            redirect_url=redirect_url,
            promo_code=normalized_promo or "",
            original_amount_eur=amount_eur,
        )

    try:
        charged, checkout_ccy, fx_rate = eur_to_checkout_amount(final_eur, ccy_req)
    except FxCheckoutError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    except FxUpstreamError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e

    meta = {
        "payment_plan": payment_plan,
        "installment_number": installment_number,
        "installment_total": installment_total,
    }
    if normalized_promo:
        meta["promo_code"] = normalized_promo
    label = "Coach onboarding fee"
    if payment_plan == "installments":
        label = f"Coach onboarding installment {installment_number}/{installment_total}"

    try:
        payment_id, checkout_url = create_mollie_payment(
            amount=charged,
            currency=checkout_ccy,
            description=f"{label} {mentor.email}",
            redirect_url=redirect_url,
            webhook_url=webhook_url,
            metadata={
                "kind": "mentor_onboarding",
                "mentor_id": mentor.id,
                "email": mentor.email,
                "promo_code": normalized_promo or "",
                **{k: str(v) for k, v in meta.items()},
            },
        )
    except MollieServiceError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    now = _utcnow()
    row = MentorOnboardingPayment(
        id=new_uuid(),
        mentor_id=mentor.id,
        amount=charged,
        amount_base_eur=final_eur,
        currency=checkout_ccy,
        fx_rate_used=fx_rate if checkout_ccy != "EUR" else None,
        status="open",
        mollie_payment_id=payment_id,
        checkout_url=checkout_url,
        metadata_json=json.dumps(meta),
        payment_plan=payment_plan,
        installment_number=installment_number,
        installment_total=installment_total,
        paid_at=None,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    return row


def activate_coach_after_email_verification(
    db: Session,
    *,
    mentor: Mentor,
    redirect_url: str | None = None,
) -> MentorOnboardingPayment | None:
    """Record free onboarding waiver after email OTP. Admin approval still required to go live."""
    if mentor_onboarding_is_complete(db, mentor.id):
        # Do not auto-approve — admin must approve from the dashboard.
        return None
    login_url = redirect_url or f"{settings.mollie_redirect_base_url.rstrip('/')}/login?role=mentor"
    return _create_onboarding_promo_waiver(
        db,
        mentor=mentor,
        redirect_url=login_url,
        promo_code="",
        original_amount_eur=Decimal("0.00"),
    )


def ensure_free_onboarding_completed(
    db: Session,
    *,
    mentor: Mentor,
    redirect_url: str | None = None,
) -> MentorOnboardingPayment | None:
    """Back-compat alias — free onboarding after email verification (pending admin approval)."""
    return activate_coach_after_email_verification(db, mentor=mentor, redirect_url=redirect_url)


def _create_onboarding_promo_waiver(
    db: Session,
    *,
    mentor: Mentor,
    redirect_url: str,
    promo_code: str,
    original_amount_eur: Decimal,
) -> MentorOnboardingPayment:
    """Record a zero-amount onboarding waiver. Leaves coach pending until admin approval."""
    payment_id = f"promo_{new_uuid().replace('-', '')}"
    meta = {
        "payment_plan": "full",
        "installment_number": 1,
        "installment_total": 1,
        "promo_code": promo_code,
        "payment_gateway": "free" if not promo_code else "promo",
        "original_amount_eur": str(original_amount_eur),
    }
    now = _utcnow()
    row = MentorOnboardingPayment(
        id=new_uuid(),
        mentor_id=mentor.id,
        amount=Decimal("0.00"),
        amount_base_eur=Decimal("0.00"),
        currency="EUR",
        fx_rate_used=None,
        status="paid",
        mollie_payment_id=payment_id,
        checkout_url=redirect_url,
        metadata_json=json.dumps(meta),
        payment_plan="full",
        installment_number=1,
        installment_total=1,
        paid_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    if promo_code:
        apply_promo_code(db, promo_code, commit=False)
    # Keep pending until an admin approves; do not set is_approved / active here.
    mentor.updated_at = now
    db.flush()
    return row


def apply_onboarding_payment_paid(db: Session, onboarding: MentorOnboardingPayment) -> None:
    onboarding.status = "paid"
    onboarding.paid_at = _utcnow()
    onboarding.updated_at = _utcnow()
    db.flush()
    mentor = db.query(Mentor).filter(Mentor.id == onboarding.mentor_id).first()
    if not mentor:
        return
    # Paid onboarding fee does not bypass admin approval.
    mentor.updated_at = _utcnow()
    db.flush()
