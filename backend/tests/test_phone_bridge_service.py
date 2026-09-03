import unittest

from services.phone_bridge_service import bridge_room_name, validate_bridge_numbers


class PhoneBridgeServiceTests(unittest.TestCase):
    def test_bridge_room_name(self) -> None:
        self.assertEqual(bridge_room_name("abc-123"), "bridge-abc-123")

    def test_validate_bridge_numbers_valid(self) -> None:
        a, b = validate_bridge_numbers("+31612345678", "+919999888877")
        self.assertEqual(a, "+31612345678")
        self.assertEqual(b, "+919999888877")

    def test_validate_bridge_numbers_invalid(self) -> None:
        with self.assertRaises(ValueError):
            validate_bridge_numbers("123", "+919999888877")

    def test_validate_bridge_numbers_must_differ(self) -> None:
        with self.assertRaises(ValueError):
            validate_bridge_numbers("+31612345678", "+31612345678")


if __name__ == "__main__":
    unittest.main()
