from unittest.mock import patch

from services.email_service import _build_message, send_plain_email, send_plain_emails


def test_send_plain_email_rejects_invalid_recipient():
    assert send_plain_email(to_email="", subject="Hello", body="Hi") is False
    assert send_plain_email(to_email="not-an-email", subject="Hello", body="Hi") is False


def test_send_plain_emails_reports_no_valid_recipients():
    sent, warning = send_plain_emails([("", "Hello", "Hi"), ("nope", "Hello", "Hi")])
    assert sent == 0
    assert warning


def test_support_style_message_sets_reply_to_and_display_name():
    with patch(
        "services.email_service._from_parts",
        return_value=("info@mijnlevenspad.com", "Mijn Levenspad"),
    ):
        msg = _build_message(
            to_email="info@mijnlevenspad.com",
            subject="Help",
            body="Hello",
            reply_to="user@example.com",
            from_name="Ada via User support",
        )
    assert "user@example.com" in msg["Reply-To"]
    assert "Ada via User support" in msg["From"]
    assert "info@mijnlevenspad.com" in msg["From"]
