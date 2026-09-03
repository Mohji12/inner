# Start local API (FastAPI on :8001).
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $RepoRoot "backend"
Set-Location $Backend

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "Creating venv..."
    python -m venv .venv
    & .\.venv\Scripts\python.exe -m pip install -r requirements.txt
}

if (-not (Test-Path ".\.env")) {
    Write-Error "Missing backend\.env — copy from .env.example and fill values."
}

Write-Host "API: http://127.0.0.1:8001  (health: /health)"
& .\.venv\Scripts\uvicorn.exe main:app --reload --host 127.0.0.1 --port 8001
