"""Amplify SPA rewrites: static assets served as-is; index.html for app routes."""
import json
import os
import subprocess
import sys

APP_ID = os.environ.get("AMPLIFY_APP_ID", "")
REGION = os.environ.get("AMPLIFY_REGION", "ap-south-1")

# 1) Trailing-slash SPA paths (S3 301s /path -> /path/) -> index.html
# 2) All other missing routes -> index.html (404-200), without touching existing /assets/*.js
RULES = [
    {"source": r"</^(.+)/$/>", "target": "/index.html", "status": "200"},
    {"source": "/<*>", "target": "/index.html", "status": "404-200"},
]


def main() -> int:
    if not APP_ID:
        print("AMPLIFY_APP_ID required", file=sys.stderr)
        return 1
    subprocess.run(
        [
            "aws",
            "amplify",
            "update-app",
            "--app-id",
            APP_ID,
            "--region",
            REGION,
            "--custom-rules",
            json.dumps(RULES),
        ],
        check=True,
    )
    print(json.dumps(RULES, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
