from collections.abc import Mapping

SUPPORTED_LANGS = {"en", "nl", "fr", "ar", "zh", "ru", "es"}
DEFAULT_LANG = "en"


def normalize_lang(raw: str | None) -> str:
    if not raw:
        return DEFAULT_LANG
    candidate = raw.strip().lower().split(",")[0].split("-")[0]
    return candidate if candidate in SUPPORTED_LANGS else DEFAULT_LANG


def to_i18n_map(text: str | None, lang: str = DEFAULT_LANG) -> dict[str, str] | None:
    if text is None:
        return None
    value = text.strip()
    if not value:
        return None
    safe_lang = normalize_lang(lang)
    return {safe_lang: value}


def resolve_i18n_text(
    i18n_value: Mapping[str, str] | None,
    fallback_text: str | None,
    lang: str | None,
) -> str | None:
    if isinstance(i18n_value, Mapping):
        target = normalize_lang(lang)
        if isinstance(i18n_value.get(target), str) and i18n_value[target].strip():
            return i18n_value[target]
        if isinstance(i18n_value.get(DEFAULT_LANG), str) and i18n_value[DEFAULT_LANG].strip():
            return i18n_value[DEFAULT_LANG]
        for value in i18n_value.values():
            if isinstance(value, str) and value.strip():
                return value
    return fallback_text
