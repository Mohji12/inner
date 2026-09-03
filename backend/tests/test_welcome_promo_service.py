from unittest.mock import MagicMock

from services.welcome_promo_service import welcome_promo_eligibility
from services.promo_service import user_has_completed_booking


def _promo_row(*, duration: int = 5):
    row = MagicMock()
    row.code = "WELCOME5"
    row.allowed_duration_minutes = duration
    row.id = "promo-welcome"
    return row


def test_welcome_promo_eligible_for_new_user():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [
        _promo_row(),
        None,
        None,
    ]

    from services import welcome_promo_service as svc

    original = svc.get_welcome_promo_row
    original_redeemed = svc.user_has_redeemed_promo
    original_booking = svc.user_has_completed_booking
    try:
        svc.get_welcome_promo_row = lambda _db: _promo_row()
        svc.user_has_redeemed_promo = lambda _db, _uid, _promo: False
        svc.user_has_completed_booking = lambda _db, _uid: False
        out = welcome_promo_eligibility(db, "user-1")
    finally:
        svc.get_welcome_promo_row = original
        svc.user_has_redeemed_promo = original_redeemed
        svc.user_has_completed_booking = original_booking

    assert out["eligible"] is True
    assert out["code"] == "WELCOME5"
    assert out["duration_minutes"] == 5


def test_welcome_promo_not_eligible_after_redemption():
    db = MagicMock()
    from services import welcome_promo_service as svc

    original = svc.get_welcome_promo_row
    original_redeemed = svc.user_has_redeemed_promo
    original_booking = svc.user_has_completed_booking
    try:
        svc.get_welcome_promo_row = lambda _db: _promo_row()
        svc.user_has_redeemed_promo = lambda _db, _uid, _promo: True
        svc.user_has_completed_booking = lambda _db, _uid: False
        out = welcome_promo_eligibility(db, "user-1")
    finally:
        svc.get_welcome_promo_row = original
        svc.user_has_redeemed_promo = original_redeemed
        svc.user_has_completed_booking = original_booking

    assert out["eligible"] is False
    assert "already used" in (out["message"] or "").lower()


def test_user_has_completed_booking_true():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = object()
    assert user_has_completed_booking(db, "user-1") is True

    db.query.return_value.filter.return_value.first.return_value = None
    assert user_has_completed_booking(db, "user-2") is False
