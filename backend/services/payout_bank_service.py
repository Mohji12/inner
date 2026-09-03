"""Normalize and validate coach bank details for manual share transfers."""
from __future__ import annotations

import re


def normalize_iban(raw: str) -> str:
    return "".join(c for c in raw.upper().replace(" ", "") if c.isalnum())


def validate_and_normalize_iban(raw: str) -> str:
    iban = normalize_iban(raw)
    if len(iban) < 15 or len(iban) > 34:
        raise ValueError("IBAN must be between 15 and 34 characters.")
    if not re.match(r"^[A-Z0-9]+$", iban):
        raise ValueError("IBAN may only contain letters and digits.")
    return iban


def mask_iban(iban: str) -> str:
    if len(iban) <= 8:
        return "*" * len(iban) if iban else "****"
    return iban[:4] + ("*" * (len(iban) - 8)) + iban[-4:]


def normalize_bic(raw: str | None) -> str | None:
    if raw is None or not str(raw).strip():
        return None
    bic = "".join(str(raw).upper().split())
    if len(bic) not in (8, 11):
        raise ValueError("BIC / SWIFT must be 8 or 11 characters when provided.")
    if not re.match(r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$", bic):
        raise ValueError("BIC format is invalid.")
    return bic


def mask_bic(bic: str | None) -> str | None:
    if not bic:
        return None
    if len(bic) <= 4:
        return "****"
    return bic[:4] + "*" * max(2, len(bic) - 6) + bic[-2:]
