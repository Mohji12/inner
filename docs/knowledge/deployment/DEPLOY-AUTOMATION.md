# Deploy automation (Mijn Levenspad)

Windows PowerShell scripts under `scripts/deploy/` publish the SPA to **AWS Amplify** (manual zip) and the API to **EC2** (zip + SSH), following the same pattern as other projects in this workspace.

## Prerequisites

- AWS CLI v2 configured (`aws sts get-caller-identity` works)
- OpenSSH client (`ssh`, `scp`)
- Node.js / npm (frontend build)
- Python venv at `backend/.venv` (backend zip helper; optional for Amplify-only)
- SSH PEM (or PuTTY `.ppk`) that can log into the API host

## One-time setup

```powershell
Copy-Item .\scripts\deploy\config.example.env .\scripts\deploy\config.env
# Edit config.env: EC2_SSH_KEY, AMPLIFY_APP_ID (or leave blank + -CreateApp), VITE_API_URL
```

`config.env` is gitignored. Never commit PEMs or production secrets.

### Amplify app

Staging `staging.dutgt85z7f3h6.amplifyapp.com` may live in a **different AWS account** than the CLI profile on this machine. Either:

1. Use credentials for the account that owns that app and set `AMPLIFY_APP_ID=dutgt85z7f3h6`, or
2. Create an app in the current account:

```powershell
.\scripts\deploy\deploy-frontend.ps1 -CreateApp
```

The script writes the new `AMPLIFY_APP_ID` back into `config.env`.

### EC2 SSH

Set `EC2_SSH_KEY` to an OpenSSH PEM, or `EC2_PPK_KEY` to a `.ppk` (auto-converted).

Probe layout without deploying:

```powershell
.\scripts\deploy\deploy-all.ps1 -ProbeBackendOnly
```

Then set `EC2_REMOTE_DIR` and `EC2_SYSTEMD_SERVICE` in `config.env` if auto-detect is incomplete.

## Commands

```powershell
# Full stack
.\scripts\deploy\deploy-all.ps1

# Frontend only (optionally create Amplify app)
.\scripts\deploy\deploy-all.ps1 -FrontendOnly -CreateAmplifyApp

# Backend only / probe
.\scripts\deploy\deploy-all.ps1 -BackendOnly
.\scripts\deploy\deploy-all.ps1 -ProbeBackendOnly
```

## What each path does

| Path | Behavior |
|------|----------|
| Backend | Zip `backend/` (skip `.env`, venv, uploads) → SCP → extract preserving remote `.env`/venv → `pip install` → restart systemd → hit `BACKEND_HEALTH_URL` |
| Frontend | `npm run build` with `VITE_API_URL` → zip `dist/` → Amplify `create-deployment` → upload → `start-deployment` → poll until `SUCCEED` |

## SPA routing

`amplify.yml` is for Git-connected Amplify builds. Manual zip deploys should keep a 404→`/index.html` rewrite (the `-CreateApp` path sets this).

## Health URLs

- API: `https://life.mijnlevenspad.com/health`
- SPA: `FRONTEND_HEALTH_URL` or `https://{branch}.{appId}.amplifyapp.com/`
