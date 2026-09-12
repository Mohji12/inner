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
# Random alphanumeric blobs like "ZR61ploJwz" / "FFjFTtCqaX" / long message soup.
_TOKEN_RE = re.compile(r"^[A-Za-z0-9]{8,}$")
_URL_RE = re.compile(r"https?://|www\.", re.I)
_WORD_RE = re.compile(r"[A-Za-z]{3,}")


@dataclass(frozen=True)
class AntiSpamResult:
    blocked: bool
    reason: str | None = None
    # When True, return a normal success response without emailing (honeypot / spam).
    silent: bool = False


def _vowel_ratio(letters: str) -> float:
    if not letters:
        return 0.0
    vowels = sum(1 for c in letters.lower() if c in "aeiou")
    return vowels / len(letters)


def _looks_like_random_token(value: str) -> bool:
    """Single no-space token that looks machine-generated."""
    if not _TOKEN_RE.fullmatch(value):
        return False
    has_digit = any(c.isdigit() for c in value)
    has_lower = any(c.islower() for c in value)
    has_upper = any(c.isupper() for c in value)
    # Digits mixed into an alphanumeric blob (very common bot filler).
    if has_digit and any(c.isalpha() for c in value):
        return True
    # Mixed-case letter soup with no spaces, e.g. FFjFTtCqaX / zsMSEqMR7F.
    if has_lower and has_upper and len(value) >= 8:
        return True
    letters = re.sub(r"[^A-Za-z]", "", value)
    if len(letters) >= 8 and _vowel_ratio(letters) < 0.18:
        return True
    return False


def _looks_like_gibberish(text: str) -> bool:
    value = (text or "").strip()
    if not value:
        return False
    if _looks_like_random_token(value):
        return True
    # Long message with no whitespace is almost never a real support request.
    if len(value) >= 20 and not re.search(r"\s", value) and not _URL_RE.search(value):
        return True
    tokens = re.findall(r"[A-Za-z0-9]{6,}", value)
    if len(tokens) >= 2:
        gibberish_tokens = sum(1 for t in tokens if _looks_like_random_token(t))
        if gibberish_tokens >= 2:
            return True
    letters = re.sub(r"[^A-Za-z]", "", value)
    if len(letters) >= 10 and _vowel_ratio(letters) == 0:
        return True
    return False


def _message_lacks_real_words(message: str) -> bool:
    """True when the body has no normal word-like tokens (bot alphanumeric paste)."""
    value = (message or "").strip()
    if len(value) < 10:
        return False
    words = _WORD_RE.findall(value)
    if not words:
        return True
    # All "words" are short random chunks inside an otherwise unbroken string.
    if len(words) <= 1 and not re.search(r"\s", value) and len(value) >= 16:
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
    Honeypot / obvious spam are silent (fake success) so bots do not adapt.
    """
    clock = time.time() if now is None else now

    if (website or "").strip():
        logger.info("contact spam blocked: honeypot filled")
        return AntiSpamResult(blocked=True, reason="honeypot", silent=True)

    if form_started_at is None:
        logger.info("contact spam blocked: missing form_started_at")
        return AntiSpamResult(blocked=True, reason="missing_timing", silent=True)

    try:
        started = float(form_started_at)
    except (TypeError, ValueError):
        return AntiSpamResult(blocked=True, reason="invalid_timing", silent=True)

    elapsed = clock - started
    if elapsed < _MIN_FILL_SECONDS:
        logger.info("contact spam blocked: submitted too fast (%.2fs)", elapsed)
        return AntiSpamResult(blocked=True, reason="too_fast", silent=True)
    if elapsed > _MAX_FILL_SECONDS or started > clock + 30:
        logger.info("contact spam blocked: stale/future form_started_at")
        return AntiSpamResult(blocked=True, reason="stale_timing", silent=True)

    if (
        _looks_like_gibberish(full_name)
        or _looks_like_gibberish(subject)
        or (_looks_like_gibberish(message) and not _URL_RE.search(message))
        or _message_lacks_real_words(message)
    ):
        logger.info("contact spam blocked: gibberish content")
        return AntiSpamResult(blocked=True, reason="gibberish", silent=True)

    return AntiSpamResult(blocked=False)
