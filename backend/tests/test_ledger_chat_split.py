"""Unit tests for metered chat gross split (tax + platform + coach) and rounding."""
from decimal import Decimal
import unittest

from services.ledger_service import LedgerError, metered_split_amounts, q2


class LedgerChatSplitTests(unittest.TestCase):
    def test_parallel_split_one_euro(self) -> None:
        tax, platform, coach = metered_split_amounts(
            Decimal("1.00"),
            tax_percent=Decimal("21"),
            platform_percent=Decimal("30"),
        )
        self.assertEqual(tax, Decimal("0.21"))
        self.assertEqual(platform, Decimal("0.30"))
        self.assertEqual(coach, Decimal("0.49"))

    def test_parallel_split_nine_euros(self) -> None:
        gross = Decimal("9.00")
        tax, platform, coach = metered_split_amounts(
            gross,
            tax_percent=Decimal("21"),
            platform_percent=Decimal("30"),
        )
        self.assertEqual(tax, Decimal("1.89"))
        self.assertEqual(platform, Decimal("2.70"))
        self.assertEqual(coach, Decimal("4.41"))
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
