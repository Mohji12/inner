import unittest
from decimal import Decimal
from pathlib import Path

from services.charges_service import compute_coach_platform_fee_and_tax


ROOT = Path(__file__).resolve().parents[1]


class CoachAgreementAndChargesTests(unittest.TestCase):
    def test_charges_formula(self) -> None:
        out = compute_coach_platform_fee_and_tax(one_minute_rate=Decimal("1.00"))
        self.assertEqual(out.platform_fee, Decimal("0.30"))
        self.assertEqual(out.tax, Decimal("0.21"))
        self.assertEqual(out.total_deduction, Decimal("0.51"))

    def test_register_enforces_agreement_and_persists_snapshot(self) -> None:
        content = (ROOT / "api" / "v1" / "auth_mentor.py").read_text(encoding="utf-8")
        self.assertIn("Coach agreement must be accepted", content)
        self.assertIn("COACH_AGREEMENT_VERSION", content)
        self.assertIn("COACH_AGREEMENT_TEXT", content)
        self.assertIn("agreement_accepted_at", content)
        self.assertIn("agreement_text_snapshot", content)


if __name__ == "__main__":
    unittest.main()

