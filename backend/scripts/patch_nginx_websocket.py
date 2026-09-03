"""Patch EC2 nginx for WebSocket chat proxy (run on the server as root/sudo)."""
from __future__ import annotations

from pathlib import Path

SITE = Path("/etc/nginx/sites-available/life.mijnlevenspad.com")
NGINX_CONF = Path("/etc/nginx/nginx.conf")

MAP_BLOCK = """
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }
"""

WS_LOCATION = """
    location /api/v1/ws/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
    }
"""


def ensure_map() -> None:
    text = NGINX_CONF.read_text(encoding="utf-8")
    if "connection_upgrade" in text:
        print("nginx.conf: map already present")
        return
    marker = "http {"
    idx = text.find(marker)
    if idx < 0:
        raise SystemExit("Could not find http { in nginx.conf")
    insert_at = idx + len(marker)
    NGINX_CONF.write_text(text[:insert_at] + MAP_BLOCK + text[insert_at:], encoding="utf-8")
    print("nginx.conf: added connection_upgrade map")


def patch_site() -> None:
    text = SITE.read_text(encoding="utf-8")
    changed = False

    if "/api/v1/ws/" not in text:
        anchor = "    location / {"
        if anchor not in text:
            raise SystemExit("Could not find location / block in site config")
        text = text.replace(anchor, WS_LOCATION + "\n" + anchor, 1)
        changed = True
        print("site: added /api/v1/ws/ location")

    if "Connection $connection_upgrade" not in text:
        anchor = "        proxy_set_header X-Forwarded-Proto $scheme;\n"
        upgrade = (
            anchor
            + "\n        proxy_set_header Upgrade $http_upgrade;\n"
            + "        proxy_set_header Connection $connection_upgrade;"
        )
        if anchor in text:
            text = text.replace(anchor, upgrade, 1)
            changed = True
            print("site: added Upgrade headers to location /")

    if changed:
        SITE.write_text(text, encoding="utf-8")
    else:
        print("site: already patched")


def main() -> int:
    ensure_map()
    patch_site()
    print("OK — run: sudo nginx -t && sudo systemctl reload nginx")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
