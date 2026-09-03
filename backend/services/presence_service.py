from datetime import datetime, timezone
from typing import Dict, Tuple

# Frontend mentor heartbeat is ~30s; memory + DB freshness share this TTL.
# Slightly above two missed pings so flaky networks still show the coach online.
ONLINE_TTL_SECONDS = 120.0


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def last_seen_is_online(
    last_seen_at: datetime | None,
    *,
    now: datetime | None = None,
    ttl_seconds: float = ONLINE_TTL_SECONDS,
) -> bool:
    """True when a persisted last_seen_at is recent enough to count as online."""
    if last_seen_at is None:
        return False
    stamp = _aware(last_seen_at)
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return (current - stamp).total_seconds() <= ttl_seconds


class PresenceService:
    def __init__(self) -> None:
        # Key: (sub, role), Value: last_heartbeat (process-local only)
        self._online_users: Dict[Tuple[str, str], datetime] = {}

    def set_online(self, sub: str, role: str) -> None:
        self._online_users[(sub, role)] = datetime.now(timezone.utc)

    def set_offline(self, sub: str, role: str) -> None:
        if (sub, role) in self._online_users:
            del self._online_users[(sub, role)]

    def is_online_memory(self, sub: str, role: str) -> bool:
        """Process-local heartbeat only (not shared across Gunicorn workers)."""
        last_heartbeat = self._online_users.get((sub, role))
        if not last_heartbeat:
            return False
        diff = (datetime.now(timezone.utc) - last_heartbeat).total_seconds()
        if diff > ONLINE_TTL_SECONDS:
            self.set_offline(sub, role)
            return False
        return True

    def is_online(
        self,
        sub: str,
        role: str,
        *,
        last_seen_at: datetime | None = None,
    ) -> bool:
        """
        Online if this worker saw a recent heartbeat, or last_seen_at (DB) is fresh.

        Heartbeats write last_seen_at for every worker; without the DB fallback,
        list/detail can show AVAILABLE on worker A while booking fails on worker B.
        """
        if self.is_online_memory(sub, role):
            return True
        return last_seen_is_online(last_seen_at)

    def count_online(self, role: str | None = None) -> int:
        """Return how many subjects are currently online in this worker's memory."""
        now = datetime.now(timezone.utc)
        stale: list[Tuple[str, str]] = []
        count = 0
        for key, last_heartbeat in self._online_users.items():
            _sub, user_role = key
            if role is not None and user_role != role:
                continue
            if (now - last_heartbeat).total_seconds() > ONLINE_TTL_SECONDS:
                stale.append(key)
                continue
            count += 1
        for key in stale:
            self.set_offline(*key)
        return count


presence_service = PresenceService()
