from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo


class TimezoneConversionError(ValueError):
    pass


def validate_timezone_name(name: str) -> str:
    tz_name = (name or "").strip()
    if not tz_name:
        raise TimezoneConversionError("Timezone is required")
    try:
        ZoneInfo(tz_name)
    except Exception as exc:  # pragma: no cover - zoneinfo error type is platform-specific
        raise TimezoneConversionError("Invalid timezone") from exc
    return tz_name


def resolve_account_timezone(raw: str | None, *, default: str = "UTC") -> str:
    """Validate a client IANA timezone; fall back to default when missing/invalid."""
    name = (raw or "").strip()
    if not name:
        return default
    try:
        return validate_timezone_name(name)
    except TimezoneConversionError:
        return default


def apply_client_timezone(entity: object, raw: str | None) -> bool:
    """
    Update entity.timezone from a client-provided IANA name.
    Returns True when the stored value changed.
    """
    name = (raw or "").strip()
    if not name:
        return False
    try:
        tz = validate_timezone_name(name)
    except TimezoneConversionError:
        return False
    current = getattr(entity, "timezone", None)
    if current == tz:
        return False
    setattr(entity, "timezone", tz)
    return True


def local_datetime_to_utc(local_dt: datetime, tz_name: str) -> datetime:
    tz = ZoneInfo(validate_timezone_name(tz_name))
    if local_dt.tzinfo is None:
        aware_local = local_dt.replace(tzinfo=tz)
    else:
        aware_local = local_dt.astimezone(tz)
    return aware_local.astimezone(timezone.utc)


def date_time_to_utc(value_date: date, value_time: time, tz_name: str) -> datetime:
    return local_datetime_to_utc(datetime.combine(value_date, value_time), tz_name)
