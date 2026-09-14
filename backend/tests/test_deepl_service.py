"""Unit tests for DeepL service helpers (HTTP mocked)."""
from unittest.mock import MagicMock, patch

import pytest

from core import config as cfg
from services import deepl_service as ds


@pytest.fixture(autouse=True)
def _deepl_settings(monkeypatch):
    cfg._settings_cache = None
    s = cfg.get_settings()
    monkeypatch.setattr(s, "deepl_auth_key", "test-key:fx")
    monkeypatch.setattr(s, "deepl_api_url", "https://api-free.deepl.com")
    monkeypatch.setattr(s, "deepl_http_timeout_seconds", 5.0)
    ds._TAG_MEMO.clear()
    yield
    ds._TAG_MEMO.clear()
    cfg._settings_cache = None


def test_app_lang_to_deepl_maps_zh_and_supported():
    assert ds.app_lang_to_deepl("zh") == "ZH"
    assert ds.app_lang_to_deepl("nl-NL") == "NL"
    assert ds.app_lang_to_deepl("xx") == "EN"  # normalize falls back to en


def test_translate_text_posts_to_deepl():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"translations": [{"text": "Bonjour"}]}
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_resp

    with patch("services.deepl_service.httpx.Client", return_value=mock_client):
        out = ds.translate_text("Hello", "fr", source_lang="en")

    assert out == "Bonjour"
    args, kwargs = mock_client.post.call_args
    assert args[0].endswith("/v2/translate")
    assert kwargs["data"]["target_lang"] == "FR"
    assert kwargs["data"]["source_lang"] == "EN"
    assert "DeepL-Auth-Key" in kwargs["headers"]["Authorization"]


def test_translate_text_raises_when_not_configured(monkeypatch):
    monkeypatch.setattr(cfg.get_settings(), "deepl_auth_key", "")
    with pytest.raises(ds.DeepLNotConfiguredError):
        ds.translate_text("Hello", "fr")


def test_ensure_i18n_map_keeps_source_and_fills_targets():
    with patch.object(ds, "translate_text", side_effect=lambda text, lang, source_lang=None: f"{lang}:{text}"):
        out = ds.ensure_i18n_map("Hello", "en", targets=["en", "nl", "fr"])

    assert out["en"] == "Hello"
    assert out["nl"] == "nl:Hello"
    assert out["fr"] == "fr:Hello"


def test_ensure_i18n_map_skips_existing_and_empty():
    assert ds.ensure_i18n_map("  ", "en") == {}
    with patch.object(ds, "translate_text") as tr:
        out = ds.ensure_i18n_map(
            "Hello",
            "en",
            existing={"nl": "Hoi"},
            targets=["en", "nl"],
        )
    assert out == {"en": "Hello", "nl": "Hoi"}
    tr.assert_not_called()


def test_ensure_i18n_map_without_key_falls_back_to_source(monkeypatch):
    monkeypatch.setattr(cfg.get_settings(), "deepl_auth_key", "")
    out = ds.ensure_i18n_map("Hello", "en", targets=["en", "de"])
    assert out["en"] == "Hello"
    assert out["de"] == "Hello"


def test_ensure_lang_in_i18n_map_noop_without_key(monkeypatch):
    monkeypatch.setattr(cfg.get_settings(), "deepl_auth_key", "")
    assert ds.ensure_lang_in_i18n_map({"en": "Hi"}, "Hi", "fr") == {"en": "Hi"}
    assert ds.ensure_lang_in_i18n_map(None, "Hi", "fr") is None


def test_ensure_lang_in_i18n_map_fills_when_missing():
    with patch.object(ds, "translate_text", return_value="Salut") as tr:
        out = ds.ensure_lang_in_i18n_map({"en": "Hi"}, "Hi", "fr")
    assert out == {"en": "Hi", "fr": "Salut"}
    tr.assert_called_once()


def test_resolve_tag_list_i18n_uses_cache_and_translates():
    with patch.object(ds, "translate_texts", return_value=["爱情与关系"]) as tr:
        tags, mapping, dirty = ds.resolve_tag_list_i18n(
            ["liefde & relaties"],
            "zh",
            existing=None,
            budget=ds.TranslationBudget(5),
        )
    assert tags == ["爱情与关系"]
    assert dirty is True
    assert mapping["liefde & relaties"]["zh"] == "爱情与关系"
    tr.assert_called_once()

    with patch.object(ds, "translate_texts") as tr2:
        tags2, _, dirty2 = ds.resolve_tag_list_i18n(
            ["liefde & relaties"],
            "zh",
            existing=mapping,
            budget=ds.TranslationBudget(5),
        )
    assert tags2 == ["爱情与关系"]
    assert dirty2 is False
    tr2.assert_not_called()


def test_ensure_lang_retries_stub_copy_of_source():
    stub_map = {
        "en": "Hallo wereld",
        "zh": "Hallo wereld",
        "nl": "Hallo wereld",
    }
    with patch.object(ds, "translate_text", return_value="你好世界") as tr:
        out = ds.ensure_lang_in_i18n_map(stub_map, "Hallo wereld", "zh")
    assert out["zh"] == "你好世界"
    tr.assert_called_once()


def test_translate_text_retries_on_429():
    fail = MagicMock()
    fail.status_code = 429
    fail.headers = {"Retry-After": "0"}
    fail.text = "error"
    ok = MagicMock()
    ok.status_code = 200
    ok.json.return_value = {"translations": [{"text": "Bonjour"}]}
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.side_effect = [fail, ok]

    with (
        patch("services.deepl_service.httpx.Client", return_value=mock_client),
        patch("services.deepl_service.time.sleep"),
        patch("services.deepl_service._pace"),
    ):
        out = ds.translate_text("Hello", "fr", source_lang="en")
    assert out == "Bonjour"
    assert mock_client.post.call_count == 2


def test_translate_texts_posts_repeated_text_as_list():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "translations": [{"text": "A"}, {"text": "B"}],
    }
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_resp

    with (
        patch("services.deepl_service.httpx.Client", return_value=mock_client),
        patch("services.deepl_service._pace"),
    ):
        out = ds.translate_texts(["one", "two"], "fr", source_lang="en")

    assert out == ["A", "B"]
    _, kwargs = mock_client.post.call_args
    assert kwargs["data"]["target_lang"] == "FR"
    assert kwargs["data"]["text"] == ["one", "two"]
    assert isinstance(kwargs["data"], dict)


def test_resolve_tag_list_i18n_soft_fails_on_unexpected_errors():
    with patch.object(ds, "translate_texts", side_effect=TypeError("boom")):
        tags, _, dirty = ds.resolve_tag_list_i18n(
            ["listening"],
            "fr",
            existing=None,
            budget=ds.TranslationBudget(5),
        )
    assert tags == ["listening"]
    assert dirty is False
