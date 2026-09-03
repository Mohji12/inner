"""Quick connectivity check for local dev services. Run from repo root."""
from __future__ import annotations

import smtplib
import ssl
import sys
from pathlib import Path

# Load backend/.env via pydantic settings
_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))
from core.config import get_settings  # noqa: E402


def check_db(settings) -> tuple[bool, str]:
    try:
        import pymysql

        conn = pymysql.connect(
            host=settings.db_host,
            port=int(settings.db_port),
            user=settings.db_user,
            password=settings.db_password,
            database=settings.db_name,
            connect_timeout=15,
        )
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        conn.close()
        return True, f"MySQL OK ({settings.db_host}/{settings.db_name})"
    except Exception as exc:
        return False, f"MySQL FAILED: {exc}"


def check_redis(settings) -> tuple[bool, str]:
    try:
        import redis

        url = settings.redis_url
        # Upstash URL may include ssl_cert_reqs=CERT_NONE as a string query param;
        # pass ssl_cert_reqs explicitly and strip conflicting query keys.
        from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        qs.pop("ssl_cert_reqs", None)
        clean = urlunparse(parsed._replace(query=urlencode(qs, doseq=True)))
        kwargs: dict = {"socket_connect_timeout": 10}
        if clean.startswith("rediss://"):
            kwargs["ssl_cert_reqs"] = ssl.CERT_NONE
        client = redis.from_url(clean, **kwargs)
        client.ping()
        return True, "Redis OK (PING)"
    except Exception as exc:
        return False, f"Redis FAILED: {exc}"


def check_smtp(settings) -> tuple[bool, str]:
    if not settings.smtp_host:
        return True, "SMTP skipped (no host configured)"
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls(context=ctx)
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
        return True, f"SMTP OK ({settings.smtp_host})"
    except Exception as exc:
        return False, f"SMTP FAILED: {exc}"


def main() -> int:
    settings = get_settings()
    checks = [
        ("Database", check_db(settings)),
        ("Redis", check_redis(settings)),
        ("SMTP", check_smtp(settings)),
    ]
    print("=== Connectivity verification ===")
    failed = 0
    for name, (ok, msg) in checks:
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}: {msg}")
        if not ok:
            failed += 1
    print("================================")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
