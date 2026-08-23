from datetime import datetime, timezone
from typing import Dict, Tuple

class PresenceService:
    def __init__(self) -> None:
        # Key: (sub, role), Value: last_heartbeat
        self._online_users: Dict[Tuple[str, str], datetime] = {}

    def set_online(self, sub: str, role: str) -> None:
        self._online_users[(sub, role)] = datetime.now(timezone.utc)

    def set_offline(self, sub: str, role: str) -> None:
        if (sub, role) in self._online_users:
            del self._online_users[(sub, role)]

    def is_online(self, sub: str, role: str) -> bool:
        last_heartbeat = self._online_users.get((sub, role))
        if not last_heartbeat:
            return False
        
        # Consider offline if no heartbeat in 60 seconds
        diff = (datetime.now(timezone.utc) - last_heartbeat).total_seconds()
        if diff > 60:
            self.set_offline(sub, role)
            return False
        return True

    def count_online(self, role: str | None = None) -> int:
        """Return how many subjects are currently online (optionally filtered by role)."""
        now = datetime.now(timezone.utc)
        stale: list[Tuple[str, str]] = []
        count = 0
        for key, last_heartbeat in self._online_users.items():
            sub, user_role = key
            if role is not None and user_role != role:
                continue
            if (now - last_heartbeat).total_seconds() > 60:
                stale.append(key)
                continue
            count += 1
        for key in stale:
            self.set_offline(*key)
        return count

presence_service = PresenceService()
