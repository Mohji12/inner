# Start Vite SPA on :8081 (proxies /api → http://127.0.0.1:8001 when VITE_API_URL is empty).
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..."
    npm install
}

Write-Host "SPA: http://localhost:8081"
npm run dev
