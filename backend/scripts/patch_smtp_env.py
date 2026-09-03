"""One-off helper: patch SMTP_FROM_EMAIL and SMTP_PASSWORD in backend/.env."""
import re
import sys
from pathlib import Path

ENV = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/ubuntu/inner/backend/.env")
FROM_EMAIL = sys.argv[2] if len(sys.argv) > 2 else "info@mijnlevenspad.com"
PASSWORD = sys.argv[3] if len(sys.argv) > 3 else ""

if not ENV.exists():
    raise SystemExit(f"Missing {ENV}")
if not PASSWORD:
    raise SystemExit("SMTP password required as argv[3]")

text = ENV.read_text(encoding="utf-8")
text = re.sub(r"^SMTP_PASSWORD=.*$", f'SMTP_PASSWORD="{PASSWORD}"', text, flags=re.M)
text = re.sub(r"^SMTP_FROM_EMAIL=.*$", f"SMTP_FROM_EMAIL={FROM_EMAIL}", text, flags=re.M)
ENV.write_text(text, encoding="utf-8")
print(f"Patched SMTP in {ENV}")
