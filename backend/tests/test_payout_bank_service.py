import unittest

from services.payout_bank_service import mask_iban, normalize_bic, validate_and_normalize_iban


class PayoutBankServiceTests(unittest.TestCase):
    def test_validate_iban_normalize_spaces(self) -> None:
        self.assertEqual(validate_and_normalize_iban("  nl91 abna 0417 1643 00 "), "NL91ABNA0417164300")

    def test_mask_iban(self) -> None:
        self.assertEqual(mask_iban("NL91ABNA0417164300"), "NL91**********4300")

    def test_bic_optional(self) -> None:
        self.assertIsNone(normalize_bic(None))
        self.assertIsNone(normalize_bic("  "))

    def test_bic_normalize(self) -> None:
        self.assertEqual(normalize_bic("abnanl2a"), "ABNANL2A")

    def test_bic_too_short_raises(self) -> None:
        with self.assertRaises(ValueError):
            normalize_bic("ABCD")


if __name__ == "__main__":
    unittest.main()
