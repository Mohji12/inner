"""Outbound PSTN dial-in to a LiveKit room via LiveKit SIP (requires outbound trunk in LiveKit Cloud)."""

import logging
import re

from livekit import api
from livekit.api import TwirpError
from livekit.protocol.room import CreateRoomRequest
from livekit.protocol.sip import (
    CreateSIPParticipantRequest,
    ListSIPInboundTrunkRequest,
    ListSIPOutboundTrunkRequest,
    SIPParticipantInfo,
)

from core.config import settings

logger = logging.getLogger(__name__)

_E164 = re.compile(r"^\+[1-9]\d{6,14}$")


def normalize_phone_e164(raw: str | None) -> str | None:
    """Normalize profile phone numbers toward E.164 (+country…). Returns None if unusable."""
    if not raw or not str(raw).strip():
        return None
    t = "".join(c for c in str(raw).strip() if c.isdigit() or c == "+")
    if not t:
        return None
    if t.startswith("+"):
        return t if _E164.match(t) else None
    if t.isdigit() and 10 <= len(t) <= 15:
        return "+" + t
    return None


async def _validate_outbound_trunk_id(lkapi: api.LiveKitAPI, trunk_id: str) -> None:
    """Fail fast with a clear message if the id is missing or is an inbound trunk by mistake."""
    out_resp = await lkapi.sip.list_outbound_trunk(ListSIPOutboundTrunkRequest())
    out_ids = [t.sip_trunk_id for t in out_resp.items]
    if trunk_id in out_ids:
        return

    in_resp = await lkapi.sip.list_inbound_trunk(ListSIPInboundTrunkRequest())
    in_ids = [t.sip_trunk_id for t in in_resp.items]
    if trunk_id in in_ids:
        raise ValueError(
            f"LIVEKIT_SIP_OUTBOUND_TRUNK_ID={trunk_id!r} matches an **inbound** trunk in this project. "
            "Phone dial-out requires an **outbound** trunk: Telephony → SIP trunks → create Outbound, "
            "then set the env var to that outbound trunk id."
        )

    out_summary = ", ".join(out_ids) if out_ids else "(no outbound trunks — create one)"
    raise ValueError(
        f"LIVEKIT_SIP_OUTBOUND_TRUNK_ID={trunk_id!r} is not among outbound trunks in this LiveKit project. "
        f"Outbound ids here: {out_summary}. "
        "Use the same project as LIVEKIT_API_KEY / LIVEKIT_URL and copy the id from Telephony → SIP trunks → Outbound."
    )


def _twirp_is_room_already_exists(e: TwirpError) -> bool:
    msg = (e.message or "").lower()
    code = (e.code or "").lower()
    if e.status == 409:
        return True
    if "already" in msg or "exists" in msg or "duplicate" in msg:
        return True
    if code in ("already_exists", "failed_precondition"):
        return True
    return False


async def dial_phone_into_chat_room(
    *,
    room_name: str,
    phone_e164: str,
    participant_identity: str,
    participant_name: str,
    sip_trunk_id: str,
) -> SIPParticipantInfo:
    """Ask LiveKit to place an outbound SIP/PSTN call into the room.

    Ensures the room exists first. Browser WebRTC clients create the room implicitly on join;
    SIP dial-out does not, and LiveKit may return errors like *object cannot be found* if the room is missing.
    """
    caller = (settings.livekit_sip_caller_id or "").strip()
    req = CreateSIPParticipantRequest(
        sip_trunk_id=sip_trunk_id.strip(),
        sip_call_to=phone_e164,
        room_name=room_name,
        participant_identity=participant_identity,
        participant_name=participant_name or "Phone",
        wait_until_answered=False,
    )
    if caller:
        if not _E164.match(caller):
            logger.warning("LIVEKIT_SIP_CALLER_ID is not valid E.164; omitting sip_number: %s", caller)
        else:
            req.sip_number = caller
    url = (settings.livekit_url or "").strip()
    key = (settings.livekit_api_key or "").strip()
    secret = (settings.livekit_api_secret or "").strip()
    async with api.LiveKitAPI(url=url, api_key=key, api_secret=secret) as lkapi:
        await _validate_outbound_trunk_id(lkapi, sip_trunk_id.strip())

        try:
            await lkapi.room.create_room(
                CreateRoomRequest(
                    name=room_name,
                    empty_timeout=600,
                    max_participants=10,
                )
            )
            logger.info("LiveKit room ready for SIP: %s", room_name)
        except TwirpError as e:
            if not _twirp_is_room_already_exists(e):
                logger.error(
                    "LiveKit create_room failed: code=%s status=%s msg=%s",
                    e.code,
                    e.status,
                    e.message,
                )
                raise

        try:
            return await lkapi.sip.create_sip_participant(req)
        except TwirpError as e:
            logger.error(
                "LiveKit create_sip_participant failed: code=%s status=%s msg=%s meta=%s trunk=%s caller_set=%s",
                e.code,
                e.status,
                e.message,
                e.metadata,
                sip_trunk_id,
                bool(caller),
            )
            msg = (e.message or "").lower()
            if "cannot be found" in msg or "not found" in msg:
                hint = (
                    " Check LIVEKIT_SIP_OUTBOUND_TRUNK_ID (same project as API key). "
                    "If the trunk uses wildcard/multiple numbers, set LIVEKIT_SIP_CALLER_ID to your Twilio/Telnyx E.164."
                )
                raise TwirpError(
                    e.code,
                    (e.message or "") + hint,
                    status=e.status,
                    metadata=e.metadata,
                ) from e
            raise
