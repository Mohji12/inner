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

presence_service = PresenceService()
