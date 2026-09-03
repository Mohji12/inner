from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from models.promo_code import PromoCode
from models.promo_code_redemption import PromoCodeRedemption
from models.booking import Booking
from models.chat_purchase import ChatPurchase
from services.promo_service import (
    PromoError,
    _chat_purchase_counts_as_prior_paid_session,
    apply_promo_code,
    user_has_completed_paid_chat,
    validate_promo_code,
)


def _promo(
    *,
    allowed_duration_minutes: int | None = None,
    first_time_only: bool = False,
    scope: str = "booking",
) -> PromoCode:
    promo = PromoCode(
        id="promo-1",
        code="WELCOME5",
        discount_type="percentage",
        discount_value=Decimal("100"),
        scope=scope,
        is_active=True,
        current_uses=0,
        max_uses=None,
        min_order_amount=None,
        expires_at=None,
        mentor_id=None,
        first_time_only=first_time_only,
        allowed_duration_minutes=allowed_duration_minutes,
    )
    return promo


def _mock_db(*, promo: PromoCode | None, has_booking: bool = False, has_redemption: bool = False) -> MagicMock:
    db = MagicMock()
    promo_query = MagicMock()
    promo_query.filter.return_value.first.return_value = promo
    booking_query = MagicMock()
    booking_query.filter.return_value.first.return_value = object() if has_booking else None
    redemption_query = MagicMock()
    redemption_query.filter.return_value.first.return_value = object() if has_redemption else None

    def query_side_effect(model):
        if model is PromoCode:
            return promo_query
        if model is PromoCodeRedemption:
            return redemption_query
        return booking_query

    db.query.side_effect = query_side_effect
    return db


def test_validate_promo_accepts_matching_duration():
    db = _mock_db(promo=_promo(allowed_duration_minutes=5))
    result = validate_promo_code(
        db,
        "welcome5",
        Decimal("5.00"),
        "user-1",
        "mentor-1",
        duration_minutes=5,
    )
    assert result.code == "WELCOME5"


def test_validate_promo_accepts_chat_scope_with_duration():
    db = _mock_db(promo=_promo(allowed_duration_minutes=5, scope="all"))
    result = validate_promo_code(
        db,
        "WELCOME5",
        Decimal("5.00"),
        "user-1",
        "mentor-1",
        scope="chat",
        duration_minutes=5,
    )
    assert result.code == "WELCOME5"


def test_validate_promo_rejects_wrong_duration():
    db = _mock_db(promo=_promo(allowed_duration_minutes=5))
    with pytest.raises(PromoError, match="5-minute"):
        validate_promo_code(
            db,
            "WELCOME5",
            Decimal("5.00"),
            "user-1",
            "mentor-1",
            duration_minutes=10,
        )


def test_validate_promo_requires_duration_when_restricted():
    db = _mock_db(promo=_promo(allowed_duration_minutes=5))
    with pytest.raises(PromoError, match="5-minute"):
        validate_promo_code(
            db,
            "WELCOME5",
            Decimal("5.00"),
            "user-1",
            "mentor-1",
        )


def test_validate_promo_ignores_duration_when_unrestricted():
    db = _mock_db(promo=_promo(allowed_duration_minutes=None))
    result = validate_promo_code(
        db,
        "WELCOME5",
        Decimal("5.00"),
        "user-1",
        "mentor-1",
        duration_minutes=30,
    )
    assert result.code == "WELCOME5"


def test_validate_promo_first_time_only_blocks_repeat_users():
    db = _mock_db(promo=_promo(first_time_only=True), has_booking=True)
    with pytest.raises(PromoError, match="first-time"):
        validate_promo_code(
            db,
            "WELCOME5",
            Decimal("5.00"),
            "user-1",
            "mentor-1",
            duration_minutes=5,
        )


def test_validate_promo_blocks_user_who_already_redeemed():
    db = _mock_db(promo=_promo(first_time_only=True), has_redemption=True)
    with pytest.raises(PromoError, match="already used"):
        validate_promo_code(
            db,
            "WELCOME5",
            Decimal("5.00"),
            "user-1",
            "mentor-1",
            duration_minutes=5,
        )


def test_apply_promo_code_records_redemption():
    promo = _promo(first_time_only=True)
    db = MagicMock()
    promo_query = MagicMock()
    promo_query.filter.return_value.with_for_update.return_value.first.return_value = promo
    redemption_query = MagicMock()
    redemption_query.filter.return_value.first.return_value = None

    def query_side_effect(model):
        if model is PromoCode:
            return promo_query
        if model is PromoCodeRedemption:
            return redemption_query
        return MagicMock()

    db.query.side_effect = query_side_effect
    apply_promo_code(db, "WELCOME5", user_id="user-1", booking_id="booking-1", commit=False)
    assert db.add.called
    assert promo.current_uses == 1


def _purchase(*, status="succeeded", amount="5.00", transaction_id="tr_live123") -> ChatPurchase:
    return ChatPurchase(
        id="purchase-1",
        session_id="session-1",
        user_id="user-1",
        minutes=5,
        amount=Decimal(amount),
        amount_base_eur=Decimal(amount),
        currency="EUR",
        status=status,
        transaction_id=transaction_id,
        created_at=datetime.now(timezone.utc),
    )


def test_chat_purchase_ignores_mollie_test_and_promo_transactions():
    assert _chat_purchase_counts_as_prior_paid_session(_purchase(transaction_id="tr_test_abc")) is False
    assert _chat_purchase_counts_as_prior_paid_session(_purchase(transaction_id="promo_abc")) is False
    assert _chat_purchase_counts_as_prior_paid_session(_purchase(amount="0.00", transaction_id="tr_live123")) is False
    assert _chat_purchase_counts_as_prior_paid_session(_purchase(transaction_id="tr_live123")) is True


def test_validate_promo_allows_first_time_user_with_only_test_chat_purchase():
    db = MagicMock()
    promo_query = MagicMock()
    promo_query.filter.return_value.first.return_value = _promo(first_time_only=True, allowed_duration_minutes=5)
    redemption_query = MagicMock()
    redemption_query.filter.return_value.first.return_value = None
    booking_query = MagicMock()
    booking_query.filter.return_value.first.return_value = None
    chat_query = MagicMock()
    chat_query.filter.return_value.all.return_value = [_purchase(transaction_id="tr_test_abc")]

    def query_side_effect(model):
        if model is PromoCode:
            return promo_query
        if model is PromoCodeRedemption:
            return redemption_query
        if model is ChatPurchase:
            return chat_query
        return booking_query

    db.query.side_effect = query_side_effect
    result = validate_promo_code(
        db,
        "WELCOME5",
        Decimal("5.00"),
        "user-1",
        "mentor-1",
        duration_minutes=5,
    )
    assert result.code == "WELCOME5"


def test_user_has_completed_paid_chat_true_for_live_payment():
    db = MagicMock()
    chat_query = MagicMock()
    chat_query.filter.return_value.all.return_value = [_purchase(transaction_id="tr_Wpmp123")]
    db.query.return_value = chat_query
    assert user_has_completed_paid_chat(db, "user-1") is True
