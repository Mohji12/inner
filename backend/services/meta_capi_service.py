from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal

import httpx

from core.config import settings

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


def _send_event(
    *,
    event_name: str,
    event_id: str,
    user_email: str | None = None,
    user_phone: str | None = None,
    value: Decimal | None = None,
    currency: str | None = None,
    custom_data: dict | None = None,
) -> None:
    if not _enabled():
        return

    now_ts = int(datetime.now(timezone.utc).timestamp())
    payload: dict = {
        "data": [
            {
                "event_name": event_name,
                "event_time": now_ts,
                "action_source": "website",
                "event_id": event_id,
                "user_data": {},
            }
        ]
    }
    user_data = payload["data"][0]["user_data"]
    em = _sha256_normalized(user_email)
    ph = _sha256_phone(user_phone)
    if em:
        user_data["em"] = [em]
    if ph:
        user_data["ph"] = [ph]

    if value is not None:
        payload["data"][0]["custom_data"] = {
            "value": float(value),
            "currency": (currency or "EUR").upper(),
            **(custom_data or {}),
        }
    elif custom_data:
        payload["data"][0]["custom_data"] = custom_data

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
    except Exception as exc:
        logger.warning("Meta CAPI %s error: %s", event_name, exc)


def track_user_registration_verified(*, user_id: str, email: str | None, phone_number: str | None) -> None:
    _send_event(
        event_name="CompleteRegistration",
        event_id=f"user-verify-{user_id}",
        user_email=email,
        user_phone=phone_number,
    )


def track_mentor_registration_verified(*, mentor_id: str, email: str | None, phone_number: str | None) -> None:
    _send_event(
        event_name="CompleteRegistration",
        event_id=f"mentor-verify-{mentor_id}",
        user_email=email,
        user_phone=phone_number,
        custom_data={"registration_role": "mentor"},
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
    )
