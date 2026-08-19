import unittest
from decimal import Decimal

from services.wallet_topup_service import (
    resolve_wallet_topup_credit_amount,
    wallet_topup_charge_eur,
    wallet_topup_fee_eur,
)


class WalletTopupFeeTests(unittest.TestCase):
    def test_charge_adds_transaction_fee(self) -> None:
        self.assertEqual(wallet_topup_fee_eur(), Decimal("0.50"))
        self.assertEqual(wallet_topup_charge_eur(Decimal("5.00")), Decimal("5.50"))
        self.assertEqual(wallet_topup_charge_eur(Decimal("20.00")), Decimal("20.50"))

    def test_credit_uses_metadata_not_mollie_total(self) -> None:
        credit, ccy = resolve_wallet_topup_credit_amount(
            {
                "amount": {"value": "5.50", "currency": "EUR"},
                "metadata": {
                    "kind": "wallet_topup",
                    "amount": "5.00",
                    "credit_amount": "5.00",
                    "charge_amount": "5.50",
                    "transaction_fee": "0.50",
                    "currency": "EUR",
                },
            }
        )
        self.assertEqual(credit, Decimal("5.00"))
        self.assertEqual(ccy, "EUR")

    def test_legacy_topup_credits_metadata_amount(self) -> None:
        credit, _ = resolve_wallet_topup_credit_amount(
            {
                "amount": {"value": "5.00", "currency": "EUR"},
                "metadata": {"amount": "5.00", "currency": "EUR"},
            }
        )
        self.assertEqual(credit, Decimal("5.00"))

    def test_mollie_total_minus_fee_when_fee_meta_without_credit(self) -> None:
        credit, _ = resolve_wallet_topup_credit_amount(
            {
                "amount": {"value": "5.50", "currency": "EUR"},
                "metadata": {"transaction_fee": "0.50", "currency": "EUR"},
            }
        )
        self.assertEqual(credit, Decimal("5.00"))
