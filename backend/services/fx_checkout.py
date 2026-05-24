"""EUR base → checkout currency for Mollie (Frankfurter/ECB rates, cached)."""

from __future__ import annotations

import time
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import httpx

from core.config import settings


class FxCheckoutError(Exception):
    """Invalid currency config or unsupported checkout currency."""


class FxUpstreamError(Exception):
    """Rate provider failed (network or bad payload)."""


# ISO 4217 minor units supported for checkout (whitelist intersection with Mollie common use).
_DECIMAL_PLACES: dict[str, int] = {
    "EUR": 2,
    "USD": 2,
    "GBP": 2,
    "CHF": 2,
    "SEK": 2,
    "NOK": 2,
    "DKK": 2,
    "PLN": 2,
    "CZK": 2,
    "HUF": 2,
    "RON": 2,
    "CAD": 2,
    "AUD": 2,
    "NZD": 2,
    "SGD": 2,
    "HKD": 2,
    "JPY": 0,
    "KRW": 0,
}


_rates_cache: dict[str, Decimal] | None = None
_rates_cache_until: float = 0.0


def normalized_checkout_currency_list() -> list[str]:
    raw = (settings.payment_checkout_currencies or "EUR").upper()
    parts = sorted({x.strip() for x in raw.split(",") if x.strip()})
    out: list[str] = []
    for c in parts:
        if len(c) != 3:
            continue
        if c not in _DECIMAL_PLACES:
            continue
        out.append(c)
    if not out:
        out = ["EUR"]
    elif "EUR" not in out:
        out.insert(0, "EUR")
    return out


def assert_checkout_currency(code: str) -> str:
    c = code.strip().upper()
    if len(c) != 3:
        raise FxCheckoutError(f"Invalid currency code: {code}")
    if c not in normalized_checkout_currency_list():
        raise FxCheckoutError(f"Checkout currency not allowed: {c}")
    if c not in _DECIMAL_PLACES:
        raise FxCheckoutError(f"Currency not configured for decimals: {c}")
    return c


def _quantize(amount: Decimal, currency: str) -> Decimal:
    places = _DECIMAL_PLACES[currency]
    exp = Decimal("0.1") ** places if places > 0 else Decimal("1")
    return amount.quantize(exp, rounding=ROUND_HALF_UP)


def _fetch_rates_eur() -> dict[str, Decimal]:
    global _rates_cache, _rates_cache_until
    now = time.time()
    ttl = max(60, int(settings.fx_rates_cache_ttl_seconds))
    if _rates_cache is not None and now < _rates_cache_until:
        return _rates_cache

    url = (settings.fx_rates_url or "").strip() or "https://api.frankfurter.app/latest"
    params = {"from": "EUR"}
    try:
        with httpx.Client(timeout=settings.fx_rates_http_timeout_seconds) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        raise FxUpstreamError(f"FX provider error: {e}") from e

    rates_raw = data.get("rates") or {}
    decoded: dict[str, Decimal] = {}
    for k, v in rates_raw.items():
        try:
            decoded[str(k).upper()] = Decimal(str(v))
        except Exception:
            continue

    decoded["EUR"] = Decimal("1")
    _rates_cache = decoded
    _rates_cache_until = now + ttl
    return decoded


def eur_to_checkout_amount(eur_amount: Decimal, checkout_currency: str) -> tuple[Decimal, str, Decimal]:
    """
    Returns (charged_amount, currency_upper, fx_rate_foreign_per_one_eur).
    """
    ccy = assert_checkout_currency(checkout_currency)
    eur_q = _quantize(Decimal(str(eur_amount)), "EUR")

    if ccy == "EUR":
        return eur_q, "EUR", Decimal("1")

    rates = _fetch_rates_eur()
    rate = rates.get(ccy)
    if rate is None:
        raise FxUpstreamError(f"FX rate unavailable for {ccy}")

    foreign = Decimal(str(eur_amount)) * rate
    converted = _quantize(foreign, ccy)
    if converted <= 0:
        raise FxCheckoutError("Converted amount invalid")
    return converted, ccy, rate


def format_mollie_amount(amount: Decimal, currency: str) -> dict[str, str]:
    """Mollie `amount` object with correct minor units for ISO currency."""
    ccy = str(currency).strip().upper()
    if ccy not in _DECIMAL_PLACES:
        raise FxCheckoutError(f"Currency not configured for Mollie formatting: {ccy}")
    q = _quantize(Decimal(str(amount)), ccy)
    places = _DECIMAL_PLACES[ccy]
    if places == 0:
        val = str(int(q))
    else:
        val = f"{q:.{places}f}"
    return {"currency": ccy, "value": val}


def parse_amount_from_mollie_payload(payment_data: dict[str, Any]) -> tuple[Decimal, str] | None:
    amt = payment_data.get("amount")
    if not isinstance(amt, dict):
        return None
    cur = amt.get("currency")
    val = amt.get("value")
    if not cur or val is None:
        return None
    try:
        return Decimal(str(val)), str(cur).upper()
    except Exception:
        return None
