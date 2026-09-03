"""Unit tests for metered chat gross split (platform + coach) and rounding."""
from decimal import Decimal
import unittest

from services.ledger_service import LedgerError, metered_split_amounts, q2


class LedgerChatSplitTests(unittest.TestCase):
    def test_split_one_euro_seventy_thirty(self) -> None:
        tax, platform, coach = metered_split_amounts(
            Decimal("1.00"),
            tax_percent=Decimal("0"),
            platform_percent=Decimal("30"),
        )
        self.assertEqual(tax, Decimal("0.00"))
        self.assertEqual(platform, Decimal("0.30"))
        self.assertEqual(coach, Decimal("0.70"))

    def test_split_nine_euros(self) -> None:
        gross = Decimal("9.00")
        tax, platform, coach = metered_split_amounts(
            gross,
            tax_percent=Decimal("0"),
            platform_percent=Decimal("30"),
        )
        self.assertEqual(tax, Decimal("0.00"))
        self.assertEqual(platform, Decimal("2.70"))
        self.assertEqual(coach, Decimal("6.30"))
        self.assertEqual(q2(tax + platform + coach), gross)

    def test_negative_coach_net_raises(self) -> None:
        with self.assertRaises(LedgerError):
            metered_split_amounts(
                Decimal("0.05"),
                tax_percent=Decimal("80"),
                platform_percent=Decimal("80"),
            )


if __name__ == "__main__":
    unittest.main()
