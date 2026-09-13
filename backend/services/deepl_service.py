"""DeepL machine translation helpers for i18n maps (coach copy, announcements, scripts)."""
from __future__ import annotations

import logging
import threading
import time
from collections.abc import Iterable, Mapping
from typing import Any
import httpx

from core.config import settings
from services.i18n_service import DEFAULT_LANG, SUPPORTED_LANGS, normalize_lang

logger = logging.getLogger(__name__)

# App locale → DeepL target_lang (Free/Pro shared codes).
_APP_TO_DEEPL: dict[str, str] = {
    "en": "EN",
    "nl": "NL",
    "fr": "FR",
    "ar": "AR",
    "zh": "ZH",
    "ru": "RU",
    "es": "ES",
    "it": "IT",
    "de": "DE",
    "ro": "RO",
}

# Free-tier friendly pacing (shared across workers in this process).
_RATE_LOCK = threading.Lock()
_LAST_CALL_AT = 0.0
_MIN_INTERVAL_SEC = 0.35


class DeepLNotConfiguredError(RuntimeError):
    """Raised when DEEPL_AUTH_KEY is missing and a translation was required."""


class DeepLError(RuntimeError):
    """Raised when the DeepL API returns an error or unexpected payload."""


def deepl_configured() -> bool:
    return bool((settings.deepl_auth_key or "").strip())


def app_lang_to_deepl(lang: str | None) -> str | None:
    code = normalize_lang(lang)
    return _APP_TO_DEEPL.get(code)


def _pace() -> None:
    global _LAST_CALL_AT
    with _RATE_LOCK:
        now = time.monotonic()
        wait = _MIN_INTERVAL_SEC - (now - _LAST_CALL_AT)
        if wait > 0:
            time.sleep(wait)
        _LAST_CALL_AT = time.monotonic()


def translate_text(
    text: str,
    target_lang: str,
    *,
    source_lang: str | None = None,
    max_retries: int = 3,
) -> str:
    """Translate a single string via DeepL. Raises if not configured or API fails."""
    cleaned = (text or "").strip()
    if not cleaned:
        return ""

    auth = (settings.deepl_auth_key or "").strip()
    if not auth:
        raise DeepLNotConfiguredError(
            "DEEPL_AUTH_KEY is not set. Add it to backend/.env to enable machine translation."
        )

    target_app = normalize_lang(target_lang)
    target_deepl = _APP_TO_DEEPL.get(target_app)
    if not target_deepl:
        logger.warning("DeepL: unsupported target lang %r; returning source text", target_lang)
        return cleaned

    source_deepl: str | None = None
    if source_lang:
        source_app = normalize_lang(source_lang)
        if source_app == target_app:
            return cleaned
        source_deepl = _APP_TO_DEEPL.get(source_app)

    base = (settings.deepl_api_url or "https://api-free.deepl.com").rstrip("/")
    url = f"{base}/v2/translate"
    form: dict[str, Any] = {
        "text": cleaned,
        "target_lang": target_deepl,
    }
    if source_deepl:
        form["source_lang"] = source_deepl

    headers = {"Authorization": f"DeepL-Auth-Key {auth}"}
    timeout = float(getattr(settings, "deepl_http_timeout_seconds", 20.0) or 20.0)

    last_error: Exception | None = None
    for attempt in range(max(1, max_retries)):
        _pace()
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, data=form, headers=headers)
        except httpx.HTTPError as exc:
            raise DeepLError(f"DeepL request failed: {exc}") from exc

        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            try:
                delay = float(retry_after) if retry_after else (1.5 * (attempt + 1))
            except ValueError:
                delay = 1.5 * (attempt + 1)
            delay = min(max(delay, 1.0), 20.0)
            last_error = DeepLError(f"DeepL HTTP 429: {(resp.text or '').strip()[:200] or 'error'}")
            logger.warning("DeepL rate limited; retry in %.1fs (attempt %s)", delay, attempt + 1)
            time.sleep(delay)
            continue

        if resp.status_code >= 400:
            detail = (resp.text or "").strip()[:400]
            # Unsupported language → soft fallback for callers that catch DeepLError.
            if resp.status_code == 400 and "target_lang" in detail.lower():
                logger.warning(
                    "DeepL unsupported target_lang=%s; keeping source text",
                    target_deepl,
                )
                return cleaned
            raise DeepLError(f"DeepL HTTP {resp.status_code}: {detail or 'error'}")

        try:
            payload = resp.json()
            translations = payload.get("translations") or []
            out = (translations[0] or {}).get("text")
        except (ValueError, TypeError, IndexError, AttributeError) as exc:
            raise DeepLError("DeepL returned an unexpected response") from exc

        if not isinstance(out, str):
            raise DeepLError("DeepL returned an unexpected response")
        return out

    raise last_error or DeepLError("DeepL rate limited")


def ensure_i18n_map(
    source_text: str | None,
    source_lang: str = DEFAULT_LANG,
    *,
    existing: Mapping[str, str] | None = None,
    targets: Iterable[str] | None = None,
    fallback_on_error: bool = True,
) -> dict[str, str]:
    """
    Build a full i18n map: keep source + existing entries, fill missing langs via DeepL.

    When DeepL is not configured or a call fails, missing langs fall back to the source text
    if fallback_on_error is True (announcements). Set False to leave gaps for later retry.
    """
    text = (source_text or "").strip()
    if not text:
        return dict(existing) if isinstance(existing, Mapping) else {}

    src = normalize_lang(source_lang)
    out: dict[str, str] = {}
    if isinstance(existing, Mapping):
        for key, value in existing.items():
            if not isinstance(key, str) or not isinstance(value, str):
                continue
            cleaned = value.strip()
            if cleaned:
                out[normalize_lang(key)] = cleaned

    out[src] = text

    wanted = {normalize_lang(t) for t in (targets if targets is not None else SUPPORTED_LANGS)}
    for lang in sorted(wanted):
        if lang in out and out[lang].strip():
            continue
        if lang == src:
            out[lang] = text
            continue
        if not deepl_configured():
            if fallback_on_error:
                out[lang] = text
            continue
        try:
            out[lang] = translate_text(text, lang, source_lang=src)
        except (DeepLNotConfiguredError, DeepLError) as exc:
            logger.warning("DeepL ensure_i18n_map failed for %s: %s", lang, exc)
            if fallback_on_error:
                out[lang] = text

    return out


def pick_translation_source(
    i18n_value: Mapping[str, str] | None,
    fallback_text: str | None,
    *,
    prefer_lang: str = DEFAULT_LANG,
) -> tuple[str, str] | None:
    """Return (text, source_lang) for DeepL, preferring English then any i18n then fallback."""
    prefer = normalize_lang(prefer_lang)
    if isinstance(i18n_value, Mapping):
        preferred = i18n_value.get(prefer)
        if isinstance(preferred, str) and preferred.strip():
            return preferred.strip(), prefer
        for key, value in i18n_value.items():
            if isinstance(value, str) and value.strip():
                return value.strip(), normalize_lang(str(key))
    if isinstance(fallback_text, str) and fallback_text.strip():
        return fallback_text.strip(), prefer
    return None


class TranslationBudget:
    """Limit live DeepL HTTP calls within a single request (Free-tier friendly)."""

    def __init__(self, max_calls: int | None = None) -> None:
        self.max_calls = max_calls
        self.used = 0

    def allow(self) -> bool:
        if self.max_calls is None:
            return True
        if self.used >= self.max_calls:
            return False
        self.used += 1
        return True


# Shared tag translations for this process (many coaches reuse the same tags).
_TAG_MEMO: dict[tuple[str, str], str] = {}


def ensure_lang_in_i18n_map(
    i18n_value: Mapping[str, str] | None,
    fallback_text: str | None,
    target_lang: str,
    *,
    budget: TranslationBudget | None = None,
) -> dict[str, str] | None:
    """
    If target_lang is missing (or is a stub copy of the source), translate only that language.

    Stub = target entry identical to source text while source lang != target (bad 429 fallbacks).
    """
    target = normalize_lang(target_lang)
    picked = pick_translation_source(i18n_value, fallback_text)

    if isinstance(i18n_value, Mapping):
        existing_val = i18n_value.get(target)
        if isinstance(existing_val, str) and existing_val.strip():
            is_stub = (
                picked is not None
                and existing_val.strip() == picked[0]
                and normalize_lang(picked[1]) != target
            )
            if not is_stub:
                return dict(i18n_value)

    if not deepl_configured() or not picked:
        return dict(i18n_value) if isinstance(i18n_value, Mapping) else None

    source_text, source_lang = picked
    source_lang = normalize_lang(source_lang)
    if source_lang == target:
        out = dict(i18n_value) if isinstance(i18n_value, Mapping) else {}
        out[target] = source_text
        return out

    if budget is not None and not budget.allow():
        return dict(i18n_value) if isinstance(i18n_value, Mapping) else None

    # Prefer auto-detect for base-field-only sources (often Dutch labeled as en).
    deepl_source = None
    if isinstance(i18n_value, Mapping):
        for key, value in i18n_value.items():
            if (
                isinstance(key, str)
                and isinstance(value, str)
                and value.strip() == source_text
                and normalize_lang(key) != target
            ):
                # Only trust the key if it isn't a mass stub fill across many langs.
                same_count = sum(
                    1
                    for v in i18n_value.values()
                    if isinstance(v, str) and v.strip() == source_text
                )
                if same_count <= 2:
                    deepl_source = normalize_lang(key)
                break

    try:
        translated = translate_text(source_text, target, source_lang=deepl_source)
    except (DeepLNotConfiguredError, DeepLError) as exc:
        logger.warning("DeepL ensure_lang_in_i18n_map failed for %s: %s", target, exc)
        return dict(i18n_value) if isinstance(i18n_value, Mapping) else None

    out: dict[str, str] = {}
    if isinstance(i18n_value, Mapping):
        for key, value in i18n_value.items():
            if not isinstance(key, str) or not isinstance(value, str) or not value.strip():
                continue
            lang_key = normalize_lang(key)
            if lang_key == target:
                continue
            # Drop stub clones of the source under other languages.
            if value.strip() == source_text and lang_key != (deepl_source or source_lang):
                continue
            out[lang_key] = value.strip()
    keep_src = deepl_source or source_lang
    out[keep_src] = source_text
    out[target] = translated
    return out


def _tag_map(existing: Mapping[str, Any] | None) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    if not isinstance(existing, Mapping):
        return out
    for source, langs in existing.items():
        if not isinstance(source, str) or not source.strip():
            continue
        if not isinstance(langs, Mapping):
            continue
        cleaned: dict[str, str] = {}
        for lang, value in langs.items():
            if isinstance(lang, str) and isinstance(value, str) and value.strip():
                cleaned[normalize_lang(lang)] = value.strip()
        if cleaned:
            out[source.strip()] = cleaned
    return out


def resolve_tag_list_i18n(
    tags: list[Any] | None,
    target_lang: str,
    *,
    existing: Mapping[str, Any] | None = None,
    budget: TranslationBudget | None = None,
    translate: bool = True,
) -> tuple[list[str] | None, dict[str, dict[str, str]] | None, bool]:
    """
    Return tags localized for target_lang.

    existing map shape: { original_tag: { lang: translation } }
    Persists successful translations into the returned map (dirty=True when changed).
    Source language is auto-detected by DeepL (tags are often Dutch/EN mix).
    """
    if not isinstance(tags, list) or not tags:
        return (None if tags is None else []), _tag_map(existing) or None, False

    target = normalize_lang(target_lang)
    tag_map = _tag_map(existing)
    dirty = False
    resolved: list[str] = []

    for raw in tags:
        if not isinstance(raw, str):
            continue
        source = raw.strip()
        if not source:
            continue

        memo_key = (source.casefold(), target)
        if memo_key in _TAG_MEMO:
            resolved.append(_TAG_MEMO[memo_key])
            bucket = tag_map.setdefault(source, {})
            if bucket.get(target) != _TAG_MEMO[memo_key]:
                bucket[target] = _TAG_MEMO[memo_key]
                dirty = True
            continue

        bucket = tag_map.setdefault(source, {})
        cached = bucket.get(target)
        if isinstance(cached, str) and cached.strip():
            _TAG_MEMO[memo_key] = cached.strip()
            resolved.append(cached.strip())
            continue

        if not translate or not deepl_configured():
            resolved.append(source)
            continue

        if budget is not None and not budget.allow():
            resolved.append(source)
            continue

        try:
            translated = translate_text(source, target, source_lang=None)
        except (DeepLNotConfiguredError, DeepLError) as exc:
            logger.warning("DeepL tag translate failed for %r → %s: %s", source, target, exc)
            resolved.append(source)
            continue

        bucket[target] = translated
        _TAG_MEMO[memo_key] = translated
        dirty = True
        resolved.append(translated)

    return resolved, (tag_map if tag_map else None), dirty
