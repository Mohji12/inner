import hmac
import hashlib
import unittest
from datetime import date

from core.config import settings
from services.mentor_monthly_fee_service import _month_anchor, _month_range, _prev_month_anchor
from services.mollie_service import parse_webhook_payment_id, verify_mollie_webhook_signature


class MollieServiceTests(unittest.TestCase):
    def test_verify_webhook_signature(self) -> None:
        body = b'{"id":"tr_abc"}'
        secret = (settings.mollie_webhook_secret or "").strip()
        if not secret:
            self.assertTrue(verify_mollie_webhook_signature(body, None))
            return
        sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        self.assertTrue(verify_mollie_webhook_signature(body, sig))
        self.assertFalse(verify_mollie_webhook_signature(body, "invalid"))

    def test_parse_webhook_payment_id(self) -> None:
        self.assertEqual(parse_webhook_payment_id(b'{"id":"tr_test"}'), "tr_test")
        self.assertEqual(parse_webhook_payment_id(b"", {"id": "tr_form"}), "tr_form")


class MentorMonthlyFeeServiceTests(unittest.TestCase):
    def test_month_helpers(self) -> None:
        self.assertEqual(_month_anchor(date(2026, 4, 27)), date(2026, 4, 1))
        self.assertEqual(_prev_month_anchor(date(2026, 4, 1)), date(2026, 3, 1))
        start, end = _month_range(date(2026, 2, 1))
        self.assertEqual(start, date(2026, 2, 1))
        self.assertEqual(end, date(2026, 2, 28))


if __name__ == "__main__":
    unittest.main()
