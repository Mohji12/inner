from datetime import datetime, timedelta, timezone

from services.presence_service import PresenceService, last_seen_is_online


def test_last_seen_is_online_fresh():
    now = datetime(2026, 8, 26, 12, 0, tzinfo=timezone.utc)
    assert last_seen_is_online(now - timedelta(seconds=30), now=now)
    assert not last_seen_is_online(now - timedelta(seconds=121), now=now)
    assert not last_seen_is_online(None, now=now)


def test_is_online_uses_db_last_seen_when_memory_empty():
    """Simulate another Gunicorn worker: no local heartbeat, but DB last_seen is fresh."""
    svc = PresenceService()
    now = datetime.now(timezone.utc)
    assert not svc.is_online("mentor-1", "mentor")
    assert svc.is_online("mentor-1", "mentor", last_seen_at=now - timedelta(seconds=20))
    assert not svc.is_online("mentor-1", "mentor", last_seen_at=now - timedelta(seconds=200))


def test_is_online_memory_still_works_without_last_seen():
    svc = PresenceService()
    svc.set_online("mentor-2", "mentor")
    assert svc.is_online("mentor-2", "mentor")
    assert svc.is_online_memory("mentor-2", "mentor")
