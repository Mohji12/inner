from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

import httpx

from core.config import settings

if TYPE_CHECKING:
    from starlette.requests import Request

logger = logging.getLogger(__name__)

_NON_DIGIT_RE = re.compile(r"\D+")


def _enabled() -> bool:
    return bool(settings.meta_pixel_id.strip() and settings.meta_capi_access_token.strip())


def _sha256_normalized(value: str | None) -> str | None:
    raw = (value or "").strip().lower()
    if not raw:
        return None
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _sha256_phone(value: str | None) -> str | None:
    raw = _NON_DIGIT_RE.sub("", value or "")
    if not raw:
        return None
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = (request.headers.get("x-forwarded-for") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return None


def _cookie_value(request: Request | None, name: str) -> str | None:
    if request is None:
        return None
    raw = request.cookies.get(name)
    return raw.strip() if raw else None


def _send_event(
    *,
    event_name: str,
    event_id: str,
    user_email: str | None = None,
    user_phone: str | None = None,
    value: Decimal | None = None,
    currency: str | None = None,
    custom_data: dict | None = None,
    request: Request | None = None,
    event_source_url: str | None = None,
) -> None:
    if not _enabled():
        logger.debug("Meta CAPI skipped (%s): pixel id or access token not configured", event_name)
        return

    now_ts = int(datetime.now(timezone.utc).timestamp())
    event: dict = {
        "event_name": event_name,
        "event_time": now_ts,
        "action_source": "website",
        "event_id": event_id,
        "user_data": {},
    }
    if event_source_url:
        event["event_source_url"] = event_source_url

    user_data = event["user_data"]
    em = _sha256_normalized(user_email)
    ph = _sha256_phone(user_phone)
    if em:
        user_data["em"] = [em]
    if ph:
        user_data["ph"] = [ph]

    client_ip = _client_ip(request)
    if client_ip:
        user_data["client_ip_address"] = client_ip
    user_agent = (request.headers.get("user-agent") or "").strip() if request else ""
    if user_agent:
        user_data["client_user_agent"] = user_agent

    fbp = _cookie_value(request, "_fbp")
    fbc = _cookie_value(request, "_fbc")
    if fbp:
        user_data["fbp"] = fbp
    if fbc:
        user_data["fbc"] = fbc

    if value is not None:
        event["custom_data"] = {
            "value": float(value),
            "currency": (currency or "EUR").upper(),
            **(custom_data or {}),
        }
    elif custom_data:
        event["custom_data"] = custom_data

    payload: dict = {"data": [event]}

    test_code = settings.meta_test_event_code.strip()
    if test_code:
        payload["test_event_code"] = test_code

    url = (
        f"https://graph.facebook.com/v20.0/{settings.meta_pixel_id.strip()}/events"
        f"?access_token={settings.meta_capi_access_token.strip()}"
    )
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload)
        if resp.status_code >= 300:
            logger.warning("Meta CAPI %s failed: %s", event_name, resp.text[:500])
        else:
            logger.info("Meta CAPI %s sent (event_id=%s)", event_name, event_id)
    except Exception as exc:
        logger.warning("Meta CAPI %s error: %s", event_name, exc)


def track_user_registration_verified(
    *,
    user_id: str,
    email: str | None,
    phone_number: str | None,
    request: Request | None = None,
) -> None:
    _send_event(
        event_name="CompleteRegistration",
        event_id=f"user-verify-{user_id}",
        user_email=email,
        user_phone=phone_number,
        request=request,
        event_source_url=f"{settings.mollie_redirect_base_url.rstrip('/')}/user/register/thank-you",
    )


def track_mentor_registration_verified(
    *,
    mentor_id: str,
    email: str | None,
    phone_number: str | None,
    request: Request | None = None,
    event_source_url: str | None = None,
) -> None:
    thank_you_url = f"{settings.mollie_redirect_base_url.rstrip('/')}/mentor/register/thank-you"
    _send_event(
        event_name="CompleteRegistration",
        event_id=f"mentor-verify-{mentor_id}",
        user_email=email,
        user_phone=phone_number,
        custom_data={"registration_role": "mentor"},
        request=request,
        event_source_url=event_source_url or thank_you_url,
    )


def track_booking_purchase(
    *,
    booking_id: str,
    email: str | None,
    phone_number: str | None,
    amount: Decimal | None,
    currency: str | None,
) -> None:
    _send_event(
        event_name="Purchase",
        event_id=f"booking-paid-{booking_id}",
        user_email=email,
        user_phone=phone_number,
        value=amount,
        currency=currency,
        event_source_url=f"{settings.mollie_redirect_base_url.rstrip('/')}/booking/thank-you",
    )
