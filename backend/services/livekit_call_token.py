"""Mint short-lived LiveKit access tokens for 1:1 chat-session calls (signaling + SFU via LiveKit)."""

from datetime import timedelta

from livekit.api import AccessToken, VideoGrants

from core.config import settings


def livekit_room_name_for_session(session_id: str) -> str:
    """Stable room id per chat session (no DB column required)."""
    return f"chat-{session_id}"


def mint_livekit_join_token(
    *,
    room_name: str,
    identity: str,
    display_name: str,
    ttl_seconds: int,
) -> str:
    """Create a JWT the browser LiveKit client uses to join the room.

    Both mic and camera publish are allowed; the client may leave the camera off until the user enables it.

    Do not set ``can_publish_sources`` with protobuf enum ints — the JWT field expects string source names,
    and wrong values can cause LiveKit Cloud to reject the token (WebSocket /settings/regions 401).
    Leaving it unset lets ``can_publish=True`` apply to all standard tracks.
    """
    grants = VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
    )
    safe_ttl = max(60, min(ttl_seconds + 120, 86400))
    key = (settings.livekit_api_key or "").strip()
    secret = (settings.livekit_api_secret or "").strip()
    at = (
        AccessToken(key, secret)
        .with_identity(identity)
        .with_name(display_name)
        .with_grants(grants)
        .with_ttl(timedelta(seconds=safe_ttl))
    )
    return at.to_jwt()
