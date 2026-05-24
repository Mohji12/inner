from services.livekit_phone_dial import normalize_phone_e164


def bridge_room_name(bridge_session_id: str) -> str:
    return f"bridge-{bridge_session_id}"


def validate_bridge_numbers(number_a: str, number_b: str) -> tuple[str, str]:
    a = normalize_phone_e164(number_a)
    b = normalize_phone_e164(number_b)
    if not a:
        raise ValueError("number_a must be a valid E.164 phone number (example: +31612345678)")
    if not b:
        raise ValueError("number_b must be a valid E.164 phone number (example: +31612345678)")
    if a == b:
        raise ValueError("number_a and number_b must be different")
    return a, b
