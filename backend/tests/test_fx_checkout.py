import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

import services.fx_checkout as fx_checkout
from services.fx_checkout import (
    FxCheckoutError,
    assert_checkout_currency,
    eur_to_checkout_amount,
    format_mollie_amount,
    normalized_checkout_currency_list,
)


def _reset_rates_cache() -> None:
    fx_checkout._rates_cache = None  # noqa: SLF001
    fx_checkout._rates_cache_until = 0.0  # noqa: SLF001


class FxCheckoutTests(unittest.TestCase):
    def setUp(self) -> None:
        _reset_rates_cache()

    def tearDown(self) -> None:
        _reset_rates_cache()

    def test_normalized_list_inserts_eur(self) -> None:
        with patch("services.fx_checkout.settings") as s:
            s.payment_checkout_currencies = "USD"
            s.fx_rates_url = "https://example.com"
            s.fx_rates_cache_ttl_seconds = 900
            s.fx_rates_http_timeout_seconds = 10.0
            out = normalized_checkout_currency_list()
            self.assertEqual(out[0], "EUR")
            self.assertIn("USD", out)

    def test_assert_checkout_currency_rejects_unknown(self) -> None:
        with patch("services.fx_checkout.settings") as s:
            s.payment_checkout_currencies = "EUR"
            with self.assertRaises(FxCheckoutError):
                assert_checkout_currency("USD")

    def test_eur_passthrough(self) -> None:
        with patch("services.fx_checkout.settings") as s:
            s.payment_checkout_currencies = "EUR"
            s.fx_rates_url = "https://example.com"
            s.fx_rates_cache_ttl_seconds = 900
            s.fx_rates_http_timeout_seconds = 10.0
            amt, ccy, rate = eur_to_checkout_amount(Decimal("10.505"), "EUR")
            self.assertEqual(ccy, "EUR")
            self.assertEqual(rate, Decimal("1"))
            self.assertEqual(amt, Decimal("10.51"))

    def test_usd_with_mocked_rates(self) -> None:
        with patch("services.fx_checkout.settings") as s:
            s.payment_checkout_currencies = "EUR,USD"
            s.fx_rates_url = "https://api.frankfurter.app/latest"
            s.fx_rates_cache_ttl_seconds = 900
            s.fx_rates_http_timeout_seconds = 10.0

            mock_resp = MagicMock()
            mock_resp.json.return_value = {"rates": {"USD": "1.0800"}}
            mock_resp.raise_for_status = lambda: None

            mock_client = MagicMock()
            mock_client.get.return_value = mock_resp
            mock_cm = MagicMock()
            mock_cm.__enter__.return_value = mock_client
            mock_cm.__exit__.return_value = None

            with patch("httpx.Client", return_value=mock_cm):
                amt, ccy, _ = eur_to_checkout_amount(Decimal("100.00"), "USD")
            self.assertEqual(ccy, "USD")
            self.assertGreater(amt, Decimal("100"))

    def test_format_mollie_amount_jpy_zero_decimals(self) -> None:
        obj = format_mollie_amount(Decimal("1500.4"), "JPY")
        self.assertEqual(obj["currency"], "JPY")
        self.assertEqual(obj["value"], "1500")


if __name__ == "__main__":
    unittest.main()
