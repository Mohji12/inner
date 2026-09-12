from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from services.mentor_presence_mode_service import (
    apply_presence_mode,
    effective_is_online,
    normalize_presence_mode,
)
from services.presence_service import ONLINE_TTL_SECONDS


class PresenceModeTests(TestCase):
    def test_normalize_falls_back_from_manual_occupied(self) -> None:
        self.assertEqual(normalize_presence_mode(None, manual_occupied=True), "paused")
        self.assertEqual(normalize_presence_mode("", manual_occupied=False), "online")
        self.assertEqual(normalize_presence_mode("OCCUPIED"), "occupied")

    def test_apply_online_clears_occupied(self) -> None:
        mentor = SimpleNamespace(
            id="m1",
            presence_mode="paused",
            manual_occupied=True,
            last_seen_at=None,
            updated_at=None,
        )
        now = datetime(2026, 9, 11, 10, 0, tzinfo=timezone.utc)
        with patch("services.mentor_presence_mode_service.presence_service") as presence:
            mode = apply_presence_mode(mentor, "online", now=now)
        self.assertEqual(mode, "online")
        self.assertFalse(mentor.manual_occupied)
        self.assertEqual(mentor.last_seen_at, now)
        presence.set_online.assert_called_once_with("m1", "mentor")

    def test_apply_offline_ages_last_seen(self) -> None:
        mentor = SimpleNamespace(
            id="m1",
            presence_mode="online",
            manual_occupied=False,
            last_seen_at=None,
            updated_at=None,
        )
        now = datetime(2026, 9, 11, 10, 0, tzinfo=timezone.utc)
        with patch("services.mentor_presence_mode_service.presence_service") as presence:
            mode = apply_presence_mode(mentor, "offline", now=now)
        self.assertEqual(mode, "offline")
        self.assertEqual(mentor.last_seen_at, now - timedelta(seconds=ONLINE_TTL_SECONDS + 60))
        presence.set_offline.assert_called_once_with("m1", "mentor")

    def test_apply_paused_and_occupied_block_bookings(self) -> None:
        mentor = SimpleNamespace(
            id="m1",
            presence_mode="online",
            manual_occupied=False,
            last_seen_at=None,
            updated_at=None,
        )
        now = datetime(2026, 9, 11, 10, 0, tzinfo=timezone.utc)
        with patch("services.mentor_presence_mode_service.presence_service"):
            apply_presence_mode(mentor, "paused", now=now)
            self.assertTrue(mentor.manual_occupied)
            self.assertEqual(mentor.presence_mode, "paused")
            apply_presence_mode(mentor, "occupied", now=now)
            self.assertTrue(mentor.manual_occupied)
            self.assertEqual(mentor.presence_mode, "occupied")

    def test_effective_is_online_false_when_offline_mode(self) -> None:
        mentor = SimpleNamespace(
            id="m1",
            presence_mode="offline",
            manual_occupied=False,
            last_seen_at=datetime.now(timezone.utc),
        )
        with patch("services.mentor_presence_mode_service.presence_service") as presence:
            presence.is_online.return_value = True
            self.assertFalse(effective_is_online(mentor))
            presence.is_online.assert_not_called()


if __name__ == "__main__":
    from unittest import main

    main()
