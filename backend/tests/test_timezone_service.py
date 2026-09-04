from types import SimpleNamespace

from services.timezone_service import (
    TimezoneConversionError,
    apply_client_timezone,
    resolve_account_timezone,
    validate_timezone_name,
)


def test_validate_timezone_name_accepts_iana():
    assert validate_timezone_name("Asia/Kolkata") == "Asia/Kolkata"
    assert validate_timezone_name(" Europe/Amsterdam ") == "Europe/Amsterdam"


def test_validate_timezone_name_rejects_invalid():
    try:
        validate_timezone_name("Not/AZone")
        assert False, "expected TimezoneConversionError"
    except TimezoneConversionError:
        pass


def test_resolve_account_timezone_falls_back():
    assert resolve_account_timezone("Asia/Kolkata") == "Asia/Kolkata"
    assert resolve_account_timezone(None) == "UTC"
    assert resolve_account_timezone("") == "UTC"
    assert resolve_account_timezone("bogus") == "UTC"


def test_apply_client_timezone_updates_entity():
    user = SimpleNamespace(timezone="UTC")
    assert apply_client_timezone(user, "America/New_York") is True
    assert user.timezone == "America/New_York"
    assert apply_client_timezone(user, "America/New_York") is False
    assert apply_client_timezone(user, "not-a-tz") is False
    assert user.timezone == "America/New_York"
