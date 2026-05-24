import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from core.config import settings

_BCRYPT_MAX_PASSWORD_BYTES = 72


def _password_bytes_for_bcrypt(plain: str) -> bytes:
    """Bcrypt only accepts secrets up to 72 bytes; hash longer UTF-8 passwords with SHA-256 first."""
    p = plain.encode("utf-8")
    if len(p) > _BCRYPT_MAX_PASSWORD_BYTES:
        return hashlib.sha256(p).digest()
    return p


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(
        _password_bytes_for_bcrypt(plain),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    h = hashed.encode("utf-8")
    p = plain.encode("utf-8")
    if len(p) <= _BCRYPT_MAX_PASSWORD_BYTES:
        return bcrypt.checkpw(p, h)
    return bcrypt.checkpw(hashlib.sha256(p).digest(), h)


def validate_password_strength(password: str) -> str | None:
    """
    Returns None if password is valid, otherwise returns a string with the error message.
    """
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r'[A-Z]', password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r'[a-z]', password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r'\d', password):
        return "Password must contain at least one digit."
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return "Password must contain at least one special character."
    return None


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_raw_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_2fa_temp_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "2fa_temp",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def verify_access_token(token: str) -> dict[str, Any] | None:
    try:
        payload = decode_access_token(token)
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def new_uuid() -> str:
    return str(uuid.uuid4())
