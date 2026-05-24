"""Mollie Connect payout gating for coach settlements."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from api.v1 import admin_router  # noqa: E402
from schemas.admin import AdminSettlementPayRequest  # noqa: E402
from services.marketplace_service import (  # noqa: E402
    MarketplaceError,
    connect_payout_gate_status,
    resolve_connect_access_token_for_payout,
)
from services.payout_gateway import PayoutResult  # noqa: E402


class _Q:
    def __init__(self, acct):
        self.acct = acct

    def filter(self, *args, **kwargs):  # noqa: ARG002
        return self

    def first(self):
        return self.acct


class _DbAcct:
    def __init__(self, acct):
        self.acct = acct

    def query(self, _model):
        return _Q(self.acct)


def test_connect_payout_gate_no_account() -> None:
    ok, msg = connect_payout_gate_status(_DbAcct(None), "mentor-id")
    assert ok is False
    assert msg and "mollie connect" in msg.lower()


def test_connect_payout_gate_missing_tokens() -> None:
    acct = MagicMock()
    acct.connect_access_token = None
    acct.connect_refresh_token = None
    acct.payouts_enabled = True
    ok, msg = connect_payout_gate_status(_DbAcct(acct), "mentor-id")
    assert ok is False
    assert msg and "oauth" in msg.lower()


def test_connect_payout_gate_payouts_disabled() -> None:
    acct = MagicMock()
    acct.connect_access_token = "a"
    acct.connect_refresh_token = "r"
    acct.payouts_enabled = False
    ok, msg = connect_payout_gate_status(_DbAcct(acct), "mentor-id")
    assert ok is False
    assert msg and "mollie" in msg.lower()


def test_connect_payout_gate_ready() -> None:
    acct = MagicMock()
    acct.connect_access_token = "a"
    acct.connect_refresh_token = "r"
    acct.payouts_enabled = True
    ok, msg = connect_payout_gate_status(_DbAcct(acct), "mentor-id")
    assert ok is True
    assert msg is None


@patch("services.marketplace_service.get_valid_connect_access_token", return_value="resolved_token")
def test_resolve_connect_access_token_for_payout(mock_get_tok: MagicMock) -> None:
    acct = MagicMock()
    acct.connect_access_token = "a"
    acct.connect_refresh_token = "r"
    acct.payouts_enabled = True
    db = _DbAcct(acct)
    out_acct, token = resolve_connect_access_token_for_payout(db, "mentor-id")
    assert token == "resolved_token"
    assert out_acct is acct
    mock_get_tok.assert_called_once_with(db, acct)


@patch("services.marketplace_service.get_valid_connect_access_token")
def test_resolve_raises_when_not_ready(mock_get_tok: MagicMock) -> None:
    db = _DbAcct(None)
    with pytest.raises(MarketplaceError):
        resolve_connect_access_token_for_payout(db, "mentor-id")
    mock_get_tok.assert_not_called()


@patch("api.v1.admin_router._settlement_row", return_value=MagicMock())
@patch.object(admin_router.payout_gateway, "create_payout")
@patch("api.v1.admin_router.resolve_connect_access_token_for_payout")
def test_admin_pay_settlement_passes_oauth_token_to_mollie(
    mock_resolve: MagicMock,
    mock_create: MagicMock,
    _mock_row: MagicMock,
) -> None:
    coach = MagicMock(provider_account_id="org_abc")
    mock_resolve.return_value = (coach, "oauth_access")
    mock_create.return_value = PayoutResult(
        provider_ref="pout_1",
        status="paid",
        processed_at=datetime.now(timezone.utc),
    )

    settlement = MagicMock()
    settlement.id = "sett-1"
    settlement.mentor_id = "mentor-1"
    settlement.status = "approved"
    settlement.net_amount = Decimal("25.00")
    settlement.currency = "EUR"
    settlement.updated_at = None

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = settlement

    admin_router.admin_pay_settlement(
        "sett-1",
        AdminSettlementPayRequest(),
        db,
        MagicMock(),
    )

    mock_create.assert_called_once()
    kwargs = mock_create.call_args.kwargs
    assert kwargs["access_token"] == "oauth_access"
    assert kwargs["mentor_account_ref"] == "org_abc"
    assert kwargs["currency"] == "EUR"
    assert kwargs["amount"] == "25.00"
