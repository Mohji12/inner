"""Simulate coach-online vs user-visible mismatch scenarios (logic test, no DB)."""

import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/home/ubuntu/inner/backend")

from services.presence_service import last_seen_is_online


def coach_dashboard_status(is_online: bool, chat_busy: bool) -> str:
    if chat_busy:
        return "busy"
    return "online" if is_online else "offline"


def user_availability(is_online: bool, chat_available: bool, unavailable_now: bool) -> str:
    if unavailable_now:
        return "unavailable"
    if not is_online:
        return "offline"
    return "available" if chat_available else "busy"


def chat_available(is_online: bool, busy: bool, unavailable_now: bool, manual_occupied: bool = False) -> bool:
    return is_online and not busy and not unavailable_now and not manual_occupied


def coach_dashboard_status_with_occupied(is_online: bool, chat_busy: bool, manual_occupied: bool) -> str:
    if chat_busy:
        return "busy"
    if manual_occupied and is_online:
        return "occupied"
    return "online" if is_online else "offline"


def user_availability_with_occupied(
    is_online: bool, chat_available_flag: bool, unavailable_now: bool, manual_occupied: bool
) -> str:
    if unavailable_now:
        return "unavailable"
    if not is_online:
        return "offline"
    if manual_occupied:
        return "occupied"
    return "available" if chat_available_flag else "busy"


def run_scenarios():
    now = datetime.now(timezone.utc)
    scenarios = [
        ("Fresh heartbeat", True, False, False, False),
        ("Heartbeat stale (>90s)", False, False, False, False),
        ("In live session", True, True, False, False),
        ("Weekly unavailability block", True, False, True, False),
        ("Manual occupied (online coach)", True, False, False, True),
        ("Stale + unavailability", False, False, True, False),
    ]
    print("=== LOGIC SCENARIOS ===")
    for label, online, busy, unavail, occupied in scenarios:
        dash = coach_dashboard_status_with_occupied(online, busy, occupied)
        pub = chat_available(online, busy, unavail, occupied)
        user = user_availability_with_occupied(online, pub, unavail, occupied)
        mismatch = dash == "online" and user != "available"
        print(f"{label}:")
        print(f"  dashboard={dash}  user={user}  mismatch={mismatch}")
    print()
    print("Fresh last_seen (30s):", last_seen_is_online(now - timedelta(seconds=30), now=now))
    print("Stale last_seen (120s):", last_seen_is_online(now - timedelta(seconds=120), now=now))


if __name__ == "__main__":
    run_scenarios()
