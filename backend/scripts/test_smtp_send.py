"""Test SMTP delivery from production (read-only diagnostic)."""
import sys

from services.email_service import send_plain_email, smtp_is_configured


def main() -> None:
    to_email = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
    if not to_email:
        print("usage: test_smtp_send.py <to_email>")
        sys.exit(1)
    print("SMTP_CONFIGURED", smtp_is_configured())
    try:
        ok = send_plain_email(
            to_email=to_email,
            subject="Mijn Levenspad — SMTP delivery test",
            body="If you received this, outbound SMTP from the API server is working.",
        )
        print("SEND_OK", ok)
    except Exception as e:
        print("SEND_FAIL", type(e).__name__, str(e))
        sys.exit(2)


if __name__ == "__main__":
    main()
