from services.i18n_service import normalize_lang, resolve_i18n_text, to_i18n_map


def test_normalize_lang_accepts_supported_base_code():
    assert normalize_lang("zh-CN,zh;q=0.9,en;q=0.8") == "zh"
    assert normalize_lang("NL") == "nl"
    assert normalize_lang("it-IT") == "it"
    assert normalize_lang("de-DE,de;q=0.9") == "de"
    assert normalize_lang(None) == "en"


def test_to_i18n_map_uses_language_and_ignores_empty():
    assert to_i18n_map("Hello", "fr") == {"fr": "Hello"}
    assert to_i18n_map("  ", "fr") is None
    assert to_i18n_map(None, "fr") is None


def test_resolve_i18n_text_prefers_selected_language_then_en_then_fallback():
    data = {"en": "Hello", "zh": "你好"}
    assert resolve_i18n_text(data, "Fallback", "zh") == "你好"
    assert resolve_i18n_text(data, "Fallback", "fr") == "Hello"
    assert resolve_i18n_text({}, "Fallback", "fr") == "Fallback"
