from services.email_service import send_plain_email, send_plain_emails


def test_send_plain_email_rejects_invalid_recipient():
    assert send_plain_email(to_email="", subject="Hello", body="Hi") is False
    assert send_plain_email(to_email="not-an-email", subject="Hello", body="Hi") is False


def test_send_plain_emails_reports_no_valid_recipients():
    sent, warning = send_plain_emails([("", "Hello", "Hi"), ("nope", "Hello", "Hi")])
    assert sent == 0
    assert warning
