"""Unit tests for booking slot helpers and webhook signature policy."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from core.booking_states import PAYMENT_UNPAID, STATUS_CANCELLED, STATUS_PENDING_PAYMENT
from services.booking_slot_service import (
    STALE_PENDING_PAYMENT_HOURS,
    active_booking_exists_on_slot,
    expire_stale_pending_bookings,
    release_booking_slot,
)
from services.marketplace_service import verify_generic_hmac_signature
from services.mollie_service import verify_mollie_webhook_signature


class _FakeSlot:
    def __init__(self, slot_id: str):
        self.id = slot_id
        self.is_booked = True


class _FakeBooking:
    def __init__(self, *, booking_id: str, slot_id: str, status: str, payment_status: str, created_at: datetime):
        self.id = booking_id
        self.slot_id = slot_id
        self.status = status
        self.payment_status = payment_status
        self.created_at = created_at


class _FakeQuery:
    def __init__(self, exists_result: bool):
        self._exists_result = exists_result

    def filter(self, *args, **kwargs):
        return self

    def exists(self):
        return object()

    def scalar(self):
        return self._exists_result


class _FakeDb:
    def __init__(self, exists_result: bool):
        self._exists_result = exists_result

    def query(self, *args, **kwargs):
        return _FakeQuery(self._exists_result)


def test_release_booking_slot_clears_flag():
    slot = _FakeSlot("slot-1")
    booking = _FakeBooking(
        booking_id="b1",
        slot_id="slot-1",
        status=STATUS_PENDING_PAYMENT,
        payment_status=PAYMENT_UNPAID,
        created_at=datetime.now(timezone.utc),
    )

    class _SlotQuery:
        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return slot

    class _Db:
        def query(self, model):
            return _SlotQuery()

    release_booking_slot(_Db(), booking)  # type: ignore[arg-type]
    assert slot.is_booked is False


def test_active_booking_exists_on_slot_true():
    db = _FakeDb(True)
    assert active_booking_exists_on_slot(db, "slot-1") is True  # type: ignore[arg-type]


def test_expire_stale_pending_bookings_cancels_and_commits(monkeypatch):
    old = datetime.now(timezone.utc) - timedelta(hours=STALE_PENDING_PAYMENT_HOURS + 1)
    stale = _FakeBooking(
        booking_id="stale-1",
        slot_id="slot-9",
        status=STATUS_PENDING_PAYMENT,
        payment_status=PAYMENT_UNPAID,
        created_at=old,
    )
    released: list[str] = []

    class _BookingQuery:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return [stale]

    class _Db:
        committed = False

        def query(self, model):
            return _BookingQuery()

        def commit(self):
            self.committed = True

    db = _Db()

    def _release(_db, booking):
        released.append(booking.id)
        booking.status = STATUS_CANCELLED

    monkeypatch.setattr("services.booking_slot_service.release_booking_slot", _release)
    count = expire_stale_pending_bookings(db)  # type: ignore[arg-type]
    assert count == 1
    assert stale.status == STATUS_CANCELLED
    assert released == ["stale-1"]
    assert db.committed is True


def test_mollie_webhook_signature_fail_closed_in_production():
    with patch("services.mollie_service.settings") as mock_settings:
        mock_settings.mollie_webhook_secret = ""
        mock_settings.environment = "production"
        assert verify_mollie_webhook_signature(b"{}", None) is False


def test_mollie_webhook_signature_optional_in_development():
    with patch("services.mollie_service.settings") as mock_settings:
        mock_settings.mollie_webhook_secret = ""
        mock_settings.environment = "development"
        assert verify_mollie_webhook_signature(b"{}", None) is True


def test_generic_hmac_signature_fail_closed_in_production():
    with patch("services.marketplace_service.settings") as mock_settings:
        mock_settings.environment = "production"
        assert verify_generic_hmac_signature(secret="", payload=b"{}", signature=None) is False
