"""Anti-spam checks for the public website contact form."""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Humans need a few seconds; bots often POST instantly.
_MIN_FILL_SECONDS = 3.0
# Reject stale / replayed form tokens.
_MAX_FILL_SECONDS = 60 * 60 * 6
# Random alphanumeric blobs like "ZR61ploJwz" / "Dsv2JCDKH5..."
_GIBBERISH_TOKEN = re.compile(r"^[A-Za-z0-9]{8,}$")
_URL_RE = re.compile(r"https?://|www\.", re.I)


@dataclass(frozen=True)
class AntiSpamResult:
    blocked: bool
    reason: str | None = None
    # When True, return a normal success response without emailing (honeypot).
    silent: bool = False


def _looks_like_gibberish(text: str) -> bool:
    value = (text or "").strip()
    if not value:
        return False
    # Single long alphanumeric token with mixed letters+digits is typical bot filler.
    if _GIBBERISH_TOKEN.fullmatch(value) and any(c.isdigit() for c in value) and any(c.isalpha() for c in value):
        return True
    tokens = re.findall(r"[A-Za-z0-9]{6,}", value)
    if len(tokens) >= 2:
        gibberish_tokens = sum(
            1
            for t in tokens
            if _GIBBERISH_TOKEN.fullmatch(t)
            and any(c.isdigit() for c in t)
            and any(c.isalpha() for c in t)
        )
        if gibberish_tokens >= 2:
            return True
    # No vowels in a longer alphabetic run (excluding short codes).
    letters = re.sub(r"[^A-Za-z]", "", value)
    if len(letters) >= 10:
        vowels = sum(1 for c in letters.lower() if c in "aeiou")
        if vowels == 0:
            return True
    return False


def evaluate_public_contact_spam(
    *,
    full_name: str,
    subject: str,
    message: str,
    website: str | None,
    form_started_at: float | None,
    now: float | None = None,
) -> AntiSpamResult:
    """
    Returns whether the submission should be blocked.
    Honeypot fills are silent (fake success) so bots do not learn the check.
    """
    clock = time.time() if now is None else now

    if (website or "").strip():
        logger.info("contact spam blocked: honeypot filled")
        return AntiSpamResult(blocked=True, reason="honeypot", silent=True)

    if form_started_at is None:
        logger.info("contact spam blocked: missing form_started_at")
        return AntiSpamResult(blocked=True, reason="missing_timing")

    try:
        started = float(form_started_at)
    except (TypeError, ValueError):
        return AntiSpamResult(blocked=True, reason="invalid_timing")

    elapsed = clock - started
    if elapsed < _MIN_FILL_SECONDS:
        logger.info("contact spam blocked: submitted too fast (%.2fs)", elapsed)
        return AntiSpamResult(blocked=True, reason="too_fast")
    if elapsed > _MAX_FILL_SECONDS or started > clock + 30:
        logger.info("contact spam blocked: stale/future form_started_at")
        return AntiSpamResult(blocked=True, reason="stale_timing")

    if _looks_like_gibberish(full_name) or _looks_like_gibberish(subject):
        logger.info("contact spam blocked: gibberish name/subject")
        return AntiSpamResult(blocked=True, reason="gibberish")

    if _looks_like_gibberish(message) and not _URL_RE.search(message):
        # Pure random blob messages with no real words.
        logger.info("contact spam blocked: gibberish message")
        return AntiSpamResult(blocked=True, reason="gibberish")

    return AntiSpamResult(blocked=False)
