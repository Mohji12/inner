import os
import unittest
from unittest.mock import patch

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

from services.payout_gateway import payout_gateway
from services.settlement_service import (
    SettlementError,
    approve_settlement,
    settlement_cycle_bounds,
    settlement_eligible_cutoff,
    settlement_fee_percent,
)


class _FakeDb:
    def commit(self) -> None:
        return None

    def refresh(self, _obj) -> None:
        return None


@dataclass
class _SettlementLike:
    status: str
    approved_by_admin: str | None = None
    updated_at: datetime | None = None


class SettlementServiceTests(unittest.TestCase):
    def test_cycle_bounds_default_span_15_days(self) -> None:
        start, end = settlement_cycle_bounds(date(2026, 4, 30))
        self.assertEqual(end, date(2026, 4, 30))
        self.assertEqual(start, date(2026, 4, 16))

    def test_eligible_cutoff_15_days_before_cycle_end(self) -> None:
        cutoff = settlement_eligible_cutoff(date(2026, 4, 30))
        self.assertEqual(cutoff.date(), date(2026, 4, 15))

    def test_fee_percent_from_env(self) -> None:
        old = os.getenv("SETTLEMENT_FEE_PERCENT")
        os.environ["SETTLEMENT_FEE_PERCENT"] = "12.5"
        try:
            self.assertEqual(settlement_fee_percent(), Decimal("12.5"))
        finally:
            if old is None:
                del os.environ["SETTLEMENT_FEE_PERCENT"]
            else:
                os.environ["SETTLEMENT_FEE_PERCENT"] = old

    def test_approve_settlement_state_transition(self) -> None:
        db = _FakeDb()
        s = _SettlementLike(status="pending")
        out = approve_settlement(db, s, "admin-1")
        self.assertEqual(out.status, "approved")
        self.assertEqual(out.approved_by_admin, "admin-1")
        self.assertIsNotNone(out.updated_at)

    def test_approve_requires_pending(self) -> None:
        db = _FakeDb()
        s = _SettlementLike(status="paid")
        with self.assertRaises(SettlementError):
            approve_settlement(db, s, "admin-1")

    @patch("services.payout_gateway.create_connected_account_payout")
    def test_payout_adapter_scaffold_returns_reference(self, mock_create: object) -> None:
        mock_create.return_value = {
            "id": "pout_fake",
            "status": "paid",
            "createdAt": "2026-01-01T00:00:00+00:00",
        }
        result = payout_gateway.create_payout(
            mentor_account_ref="acct_123",
            amount="10.00",
            currency="EUR",
            reference="ref_1",
            access_token="access_fake",
        )
        self.assertTrue(result.provider_ref.startswith("pout_"))
        self.assertIn(result.status, ("paid", "processing", "failed"))
        self.assertEqual(result.processed_at.tzinfo, timezone.utc)


if __name__ == "__main__":
    unittest.main()
