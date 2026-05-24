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


def local_datetime_to_utc(local_dt: datetime, tz_name: str) -> datetime:
    tz = ZoneInfo(validate_timezone_name(tz_name))
    if local_dt.tzinfo is None:
        aware_local = local_dt.replace(tzinfo=tz)
    else:
        aware_local = local_dt.astimezone(tz)
    return aware_local.astimezone(timezone.utc)


def date_time_to_utc(value_date: date, value_time: time, tz_name: str) -> datetime:
    return local_datetime_to_utc(datetime.combine(value_date, value_time), tz_name)
