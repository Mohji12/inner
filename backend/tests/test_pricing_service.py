from pathlib import Path
import sys
from types import SimpleNamespace

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from decimal import Decimal

import services.pricing_service as pricing_service

from services.pricing_service import (
    PricingError,
    booking_base_eur_amount,
    effective_chat_price_per_minute_eur,
    get_active_platform_pricing,
    price_for_duration,
)


class _FakeQuery:
    def __init__(self, row):
        self._row = row

    def order_by(self, _):
        return self

    def first(self):
        return self._row


class _FakeSession:
    def __init__(self, row):
        self._row = row

    def query(self, _):
        return _FakeQuery(self._row)


def _pricing(active: bool = True):
    return SimpleNamespace(
        price_5_min=Decimal("5.00"),
        price_10_min=Decimal("9.00"),
        price_20_min=Decimal("16.00"),
        price_30_min=Decimal("22.00"),
        is_active=active,
    )


def test_price_for_duration_includes_new_5_min_tier():
    pricing = _pricing(active=True)
    assert price_for_duration(pricing, 5) == Decimal("5.00")
    assert price_for_duration(pricing, 6) == Decimal("9.00")
    assert price_for_duration(pricing, 20) == Decimal("16.00")
    assert price_for_duration(pricing, 30) == Decimal("22.00")


def test_get_active_platform_pricing_rejects_inactive():
    with pytest.raises(PricingError) as exc:
        get_active_platform_pricing(_FakeSession(_pricing(active=False)))
    assert exc.value.code == "pricing_inactive"


def test_booking_base_eur_uses_mentor_per_minute_when_rate_positive():
    mentor = SimpleNamespace(chat_price_per_minute=Decimal("0.90"))
    db = _FakeSession(_pricing(active=True))
    assert booking_base_eur_amount(db, mentor=mentor, duration_minutes=10) == Decimal("9.00")
    assert booking_base_eur_amount(db, mentor=mentor, duration_minutes=5) == Decimal("4.50")


def test_booking_base_eur_falls_back_to_platform_tiers_when_no_chat_rate():
    mentor = SimpleNamespace(chat_price_per_minute=Decimal("0"))
    db = _FakeSession(_pricing(active=True))
    assert booking_base_eur_amount(db, mentor=mentor, duration_minutes=5) == Decimal("5.00")
    assert booking_base_eur_amount(db, mentor=mentor, duration_minutes=10) == Decimal("9.00")


def _patch_session_price_eur_per_minute(monkeypatch, value: Decimal) -> None:
    """`core.config.settings` is a read-only proxy; replace the module binding for tests."""
    monkeypatch.setattr(
        pricing_service,
        "settings",
        SimpleNamespace(session_price_eur_per_minute=value),
    )


def test_effective_chat_rate_replaces_legacy_default(monkeypatch):
    _patch_session_price_eur_per_minute(monkeypatch, Decimal("0.90"))
    mentor = SimpleNamespace(chat_price_per_minute=Decimal("0.10"))
    assert effective_chat_price_per_minute_eur(mentor) == Decimal("0.90")


def test_effective_chat_rate_keeps_non_legacy_values(monkeypatch):
    _patch_session_price_eur_per_minute(monkeypatch, Decimal("0.90"))
    mentor = SimpleNamespace(chat_price_per_minute=Decimal("1.25"))
    assert effective_chat_price_per_minute_eur(mentor) == Decimal("1.25")


def test_booking_base_eur_maps_legacy_db_rate_to_configured_default(monkeypatch):
    _patch_session_price_eur_per_minute(monkeypatch, Decimal("0.90"))
    mentor = SimpleNamespace(chat_price_per_minute=Decimal("0.10"))
    db = _FakeSession(_pricing(active=True))
    assert booking_base_eur_amount(db, mentor=mentor, duration_minutes=5) == Decimal("4.50")
    assert booking_base_eur_amount(db, mentor=mentor, duration_minutes=10) == Decimal("9.00")


def test_effective_chat_legacy_row_when_settings_still_legacy_uses_policy_floor(monkeypatch):
    """DB 0.10 + env 0.10 (stale cache / old .env) must not keep returning 0.10 to clients."""
    _patch_session_price_eur_per_minute(monkeypatch, Decimal("0.10"))
    mentor = SimpleNamespace(chat_price_per_minute=Decimal("0.10"))
    assert effective_chat_price_per_minute_eur(mentor) == Decimal("0.90")


def test_booking_base_when_settings_still_legacy(monkeypatch):
    _patch_session_price_eur_per_minute(monkeypatch, Decimal("0.10"))
    mentor = SimpleNamespace(chat_price_per_minute=Decimal("0.10"))
    db = _FakeSession(_pricing(active=True))
    assert booking_base_eur_amount(db, mentor=mentor, duration_minutes=5) == Decimal("4.50")
