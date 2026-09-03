# Full local E2E: API (LIFE100) + Playwright UI + cleanup
$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Repo "backend"

$env:PYTHONPATH = $Backend
$env:E2E_API = "http://127.0.0.1:8001/api/v1"
$env:E2E_FRONTEND = "http://localhost:8081"

Write-Host "=== 1) API E2E (keep accounts) ==="
Set-Location $Backend
& .\.venv\Scripts\python.exe scripts\e2e_local_full.py --keep-accounts
if ($LASTEXITCODE -ne 0) { throw "API E2E failed" }

Write-Host "`n=== 2) Playwright UI ==="
Set-Location $Repo
npx playwright install chromium 2>$null
npx playwright test -c playwright.e2e.config.ts
$uiCode = $LASTEXITCODE

Write-Host "`n=== 3) Cleanup sample accounts ==="
Set-Location $Backend
& .\.venv\Scripts\python.exe scripts\e2e_local_full.py --cleanup-only
if ($LASTEXITCODE -ne 0) { throw "Cleanup failed" }

if ($uiCode -ne 0) { throw "UI E2E failed with exit $uiCode" }
Write-Host "`n=== ALL E2E PASSED ==="
