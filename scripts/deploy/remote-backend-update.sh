#!/usr/bin/env bash
# Run ON the EC2 host (invoked by deploy-backend.ps1).
# Args: REMOTE_APP_DIR SYSTEMD_SERVICE VENV_DIR MIGRATE_SCRIPTS
set -euo pipefail

REMOTE_DIR="${1:-.}"
SYSTEMD_SERVICE="${2:-}"
VENV_DIR="${3:-.venv}"
MIGRATE_SCRIPTS="${4:-}"

cd "$REMOTE_DIR"

# Accept either repo-root layout (backend/main.py) or app-root (main.py).
if [[ -f backend/main.py ]]; then
  APP_DIR="backend"
elif [[ -f main.py ]]; then
  APP_DIR="."
else
  echo "ERROR: main.py not found under $REMOTE_DIR or $REMOTE_DIR/backend" >&2
  exit 1
fi

cd "$APP_DIR"
echo "==> App dir: $PWD"

echo "==> Installing Python deps (venv=$VENV_DIR)"
if [[ -d "$VENV_DIR" ]]; then
  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
elif [[ -d .venv ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
  VENV_DIR=.venv
else
  python3 -m venv "$VENV_DIR"
  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
fi
pip install -q --upgrade pip
pip install -q -r requirements.txt

if [[ -n "$MIGRATE_SCRIPTS" ]]; then
  export PYTHONPATH="${PWD}${PYTHONPATH:+:$PYTHONPATH}"
  IFS=',' read -ra SCRIPTS <<< "$MIGRATE_SCRIPTS"
  for s in "${SCRIPTS[@]}"; do
    s="$(echo "$s" | xargs)"
    [[ -z "$s" ]] && continue
    echo "==> Migration: $s"
    if [[ -f "scripts/$s" ]]; then
      python "scripts/$s" || true
    else
      echo "WARN: scripts/$s not found, skipping"
    fi
  done
fi

echo "==> Restarting API"
if [[ -n "$SYSTEMD_SERVICE" ]] && systemctl cat "${SYSTEMD_SERVICE}.service" >/dev/null 2>&1; then
  sudo systemctl restart "$SYSTEMD_SERVICE"
  sleep 2
  sudo systemctl --no-pager --full status "$SYSTEMD_SERVICE" | head -n 25 || true
elif [[ -n "$SYSTEMD_SERVICE" ]] && systemctl cat "$SYSTEMD_SERVICE" >/dev/null 2>&1; then
  sudo systemctl restart "$SYSTEMD_SERVICE"
  sleep 2
  sudo systemctl --no-pager --full status "$SYSTEMD_SERVICE" | head -n 25 || true
elif command -v pm2 >/dev/null 2>&1; then
  pm2 restart all || true
else
  echo "WARN: No systemd unit for '${SYSTEMD_SERVICE}'. Restart uvicorn manually."
  echo "Hint: systemctl list-units --type=service | grep -Ei 'uvicorn|gunicorn|fastapi|inner|therapy|api'"
fi

echo "==> remote-backend-update done"
