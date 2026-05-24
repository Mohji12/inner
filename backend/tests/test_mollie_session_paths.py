from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class MollieSessionPathTests(unittest.TestCase):
    def test_bookings_pay_endpoint_retired(self) -> None:
        content = (ROOT / "api" / "v1" / "bookings.py").read_text(encoding="utf-8")
        self.assertIn("Direct booking pay endpoint retired", content)
        self.assertIn("/payments/create-intent", content)

    def test_chat_checkout_uses_mollie_service(self) -> None:
        content = (ROOT / "services" / "chat_payment_service.py").read_text(encoding="utf-8")
        self.assertIn("create_mollie_payment", content)
        self.assertNotIn("create_dummy_chat_purchase", content)

    def test_payments_create_intent_wires_checkout_currency(self) -> None:
        content = (ROOT / "api" / "v1" / "payments.py").read_text(encoding="utf-8")
        self.assertIn("checkout_currency", content)
        self.assertIn("eur_to_checkout_amount", content)


if __name__ == "__main__":
    unittest.main()
