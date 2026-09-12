from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import TestCase

from services.live_session_service import (
    freeze_session_timer_for_payment,
    is_timer_frozen_for_payment,
    resume_frozen_session_timer,
    session_remaining_seconds,
)


def _session(**kwargs):
    now = datetime(2026, 9, 11, 12, 0, tzinfo=timezone.utc)
    base = dict(
        status="active",
        ends_at=now + timedelta(seconds=90),
        allocated_duration_minutes=5,
        timer_started_at=now - timedelta(minutes=1),
        timer_paused_remaining_seconds=None,
        updated_at=now,
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


class FreezeSessionTimerForPaymentTests(TestCase):
    def test_freeze_stores_remaining_and_pauses(self) -> None:
        now = datetime(2026, 9, 11, 12, 0, tzinfo=timezone.utc)
        session = _session(ends_at=now + timedelta(seconds=75))
        # Patch "now" indirectly by using ends_at close to real now — freeze uses _utcnow().
        # Instead assert relative: freeze captures remaining via wall clock; use a far future end.
        session.ends_at = datetime.now(timezone.utc) + timedelta(seconds=120)
        rem = freeze_session_timer_for_payment(session)
        self.assertTrue(is_timer_frozen_for_payment(session))
        self.assertEqual(session.status, "paused")
        self.assertGreaterEqual(rem, 115)
        self.assertLessEqual(rem, 120)
        self.assertEqual(session_remaining_seconds(session), rem)
        # Remaining stays frozen even as wall clock advances (field is static).
        session.ends_at = datetime.now(timezone.utc) - timedelta(seconds=30)
        self.assertEqual(session_remaining_seconds(session), rem)

    def test_resume_restores_remaining_plus_purchase(self) -> None:
        session = _session(
            status="paused",
            timer_paused_remaining_seconds=40,
            ends_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        resume_frozen_session_timer(session, add_minutes=10)
        self.assertFalse(is_timer_frozen_for_payment(session))
        self.assertEqual(session.status, "active")
        rem = session_remaining_seconds(session)
        # 40s frozen + 10 minutes ≈ 640s
        self.assertGreaterEqual(rem, 635)
        self.assertLessEqual(rem, 640)

    def test_resume_without_freeze_extends_from_current_end(self) -> None:
        now = datetime.now(timezone.utc)
        session = _session(status="active", ends_at=now + timedelta(seconds=30), timer_paused_remaining_seconds=None)
        resume_frozen_session_timer(session, add_minutes=5)
        rem = session_remaining_seconds(session)
        self.assertGreaterEqual(rem, 5 * 60 + 25)
        self.assertLessEqual(rem, 5 * 60 + 30)


if __name__ == "__main__":
    from unittest import main

    main()
