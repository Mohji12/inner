from core.config import settings
from services.email_service import send_plain_emails

print("prod FROM=", settings.smtp_from_email)
sent, warning = send_plain_emails(
    [
        (
            "Mohan@mijnlevenspad.com",
            "Production SMTP live — info@mijnlevenspad.com",
            "This was sent from the production API after switching away from info@bengaluruhealthcommunity.in.",
        ),
        (
            "info@mijnlevenspad.com",
            "Production SMTP live — info@mijnlevenspad.com",
            "Production backend now sends from info@mijnlevenspad.com.",
        ),
    ]
)
print("sent", sent, "warn", warning)
