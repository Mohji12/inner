from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import TestCase

from services.mollie_service import _live_session_window_on_payment
from services.live_session_service import BOOKING_JOIN_DEADLINE_MINUTES


class LiveSessionWindowOnPaymentTests(TestCase):
    def test_booking_end_matches_duration_not_join_deadline(self) -> None:
        now = datetime(2026, 9, 8, 8, 57, tzinfo=timezone.utc)
        booking = SimpleNamespace(
            duration=5,
            start_at_utc=None,
            end_at_utc=None,
            booking_date=None,
            start_time=None,
            end_time=None,
        )
        start_dt, join_deadline, duration_minutes = _live_session_window_on_payment(booking, now=now)

        self.assertEqual(duration_minutes, 5)
        self.assertEqual(start_dt, now)
        self.assertEqual(booking.start_at_utc, now)
        self.assertEqual(booking.end_at_utc, now + timedelta(minutes=5))
        self.assertEqual(join_deadline, now + timedelta(minutes=BOOKING_JOIN_DEADLINE_MINUTES))
        self.assertNotEqual(booking.end_at_utc, join_deadline)


if __name__ == "__main__":
    from unittest import main

    main()
