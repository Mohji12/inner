# Start Celery worker (marketplace tasks via Upstash Redis). Requires backend/.env.
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $RepoRoot "backend"
Set-Location $Backend

if (-not (Test-Path ".\.venv\Scripts\celery.exe")) {
    Write-Error "Missing backend\.venv — run scripts\start-backend.ps1 once first."
}

Write-Host "Celery worker (broker = REDIS_URL from .env)"
# Windows: solo pool avoids billiard/prefork issues
& .\.venv\Scripts\celery.exe -A celery_app.celery_app worker --loglevel=info --pool=solo
