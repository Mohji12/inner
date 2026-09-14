"""Refresh-token rotation must tolerate MySQL naive datetimes."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from services.token_service import _aware, rotate_refresh_token


def test_aware_treats_naive_as_utc():
    naive = datetime(2026, 9, 14, 12, 0, 0)
    assert _aware(naive).tzinfo == timezone.utc
    aware = datetime(2026, 9, 14, 12, 0, 0, tzinfo=timezone.utc)
    assert _aware(aware) is aware


def test_rotate_grace_period_accepts_naive_mysql_datetimes():
    now = datetime.now(timezone.utc)
    revoked = MagicMock()
    revoked.revoked_at = (now - timedelta(seconds=5)).replace(tzinfo=None)
    revoked.expires_at = (now + timedelta(days=7)).replace(tzinfo=None)
    revoked.subject_id = "mentor-1"

    db = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.first.side_effect = [None, revoked]

    with (
        patch("services.token_service.create_raw_refresh_token", return_value="newraw"),
        patch("services.token_service.hash_refresh_token", return_value="h"),
        patch("services.token_service.new_uuid", return_value="id1"),
        patch("services.token_service.settings") as settings,
    ):
        settings.refresh_token_expire_days = 30
        out = rotate_refresh_token(db, "oldraw", "mentor")

    assert out == ("mentor-1", "newraw")
    db.add.assert_called_once()
    db.commit.assert_called_once()
