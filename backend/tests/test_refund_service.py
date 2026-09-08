from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

from services.refund_service import (
    refund_booking_to_user_wallet_direct,
    refund_session_to_user_wallet,
    session_was_coach_no_show,
)
from services.promo_service import user_has_completed_booking, user_has_redeemed_promo


def _mock_session(*, user=True, mentor=False, timer=False):
    s = MagicMock()
    now = datetime.now(timezone.utc)
    s.id = "session-123"
    s.user_id = "user-123"
    s.mentor_id = "mentor-123"
    s.user_joined_at = now if user else None
    s.mentor_joined_at = now if mentor else None
    s.timer_started_at = now if timer else None
    s.status = "paused"
    return s


def test_session_was_coach_no_show():
    # Coach never joined
    s1 = _mock_session(user=True, mentor=False, timer=False)
    assert session_was_coach_no_show(s1) is True

    # Coach joined
    s2 = _mock_session(user=True, mentor=True, timer=True)
    assert session_was_coach_no_show(s2) is False


def test_refund_skipped_when_coach_joined():
    db = MagicMock()
    session = _mock_session(user=True, mentor=True, timer=True)
    res = refund_session_to_user_wallet(db, session=session)
    assert res == {"refunded": False, "reason": "coach_joined"}


def test_refund_booking_session_on_coach_no_show():
    db = MagicMock()
    session = _mock_session(user=True, mentor=False, timer=False)

    booking = MagicMock()
    booking.id = "booking-100"
    booking.user_id = "user-123"
    booking.mentor_id = "mentor-123"
    booking.status = "confirmed"
    booking.mentor.full_name = "Jane Coach"
    booking.user.full_name = "John User"

    payment = MagicMock()
    payment.id = "payment-100"
    payment.amount = Decimal("18.50")
    payment.amount_base_eur = Decimal("18.50")
    payment.currency = "EUR"
    payment.status = "paid"

    # db.query mocks
    def query_side_effect(model):
        m = MagicMock()
        from models.wallet import WalletTransaction
        from models.payment import Payment
        if model == WalletTransaction:
            # First time: no existing refund
            m.filter.return_value.first.return_value = None
        elif model == Payment:
            m.filter.return_value.order_by.return_value.first.return_value = payment
        return m

    db.query.side_effect = query_side_effect

    with (
        patch("services.refund_service.booking_for_chat_session", return_value=booking),
        patch("services.refund_service.credit_wallet") as mock_credit,
        patch("services.refund_service.refund_user_wallet_for_booking") as mock_ledger,
        patch("services.refund_service.release_booking_slot") as mock_slot,
        patch("services.refund_service.reverse_promo_redemption_for_booking") as mock_promo,
        patch("services.refund_service.create_notification") as mock_notif,
    ):
        res = refund_session_to_user_wallet(db, session=session)

        assert res["refunded"] is True
        assert res["already_refunded"] is False
        assert res["amount"] == 18.50
        assert res["booking_id"] == "booking-100"

        # Check booking marked unattended & mentor no-show
        assert booking.status == "unattended"
        assert booking.no_show_by == "mentor"
        assert payment.status == "refunded"

        # Check wallet credited
        mock_credit.assert_called_once()
        mock_ledger.assert_called_once()
        mock_slot.assert_called_once_with(db, booking)
        mock_promo.assert_called_once_with(db, booking.id, commit=False)
        assert mock_notif.call_count >= 2


def test_refund_is_idempotent():
    db = MagicMock()
    session = _mock_session(user=True, mentor=False, timer=False)

    booking = MagicMock()
    booking.id = "booking-100"
    booking.user_id = "user-123"

    existing_refund_tx = MagicMock()
    existing_refund_tx.amount = Decimal("18.50")

    def query_side_effect(model):
        m = MagicMock()
        from models.wallet import WalletTransaction
        if model == WalletTransaction:
            m.filter.return_value.first.return_value = existing_refund_tx
        return m

    db.query.side_effect = query_side_effect

    with (
        patch("services.refund_service.booking_for_chat_session", return_value=booking),
        patch("services.refund_service.credit_wallet") as mock_credit,
    ):
        res = refund_session_to_user_wallet(db, session=session)
        assert res["refunded"] is True
        assert res["already_refunded"] is True
        assert res["amount"] == 18.50
        # Must not double-credit wallet
        mock_credit.assert_not_called()


def test_user_has_redeemed_promo_allows_reuse_when_coach_no_show():
    db = MagicMock()
    promo = MagicMock()
    promo.id = "promo-welcome5"

    redemption = MagicMock()
    redemption.booking_id = "booking-missed"

    missed_booking = MagicMock()
    missed_booking.id = "booking-missed"
    missed_booking.no_show_by = "mentor"
    missed_booking.status = "unattended"

    def query_side_effect(model):
        m = MagicMock()
        from models.promo_code_redemption import PromoCodeRedemption
        from models.booking import Booking
        if model == PromoCodeRedemption:
            m.filter.return_value.all.return_value = [redemption]
        elif model == Booking:
            m.filter.return_value.first.return_value = missed_booking
        return m

    db.query.side_effect = query_side_effect

    # Even though a redemption row exists, because the booking was a coach no-show,
    # the user is NOT considered to have used the promo!
    assert user_has_redeemed_promo(db, "user-123", promo) is False


def test_user_has_completed_booking_ignores_coach_no_show():
    db = MagicMock()

    missed_booking = MagicMock()
    missed_booking.no_show_by = "mentor"
    missed_booking.status = "unattended"

    def query_side_effect(model):
        m = MagicMock()
        from models.booking import Booking
        if model == Booking:
            m.filter.return_value.all.return_value = [missed_booking]
        return m

    db.query.side_effect = query_side_effect

    assert user_has_completed_booking(db, "user-123") is False
