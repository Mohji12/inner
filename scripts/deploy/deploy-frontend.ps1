<#
.SYNOPSIS
  Build Vite SPA and publish to AWS Amplify (manual hosting deploy).

.EXAMPLE
  .\scripts\deploy\deploy-frontend.ps1
  .\scripts\deploy\deploy-frontend.ps1 -CreateApp
  .\scripts\deploy\deploy-frontend.ps1 -SkipBuild
#>
[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$CreateApp
)

$ErrorActionPreference = 'Stop'
$DeployRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $DeployRoot '_common.ps1')
$script:DeployRoot = $DeployRoot
Import-DeployConfig -ConfigPath (Join-Path $DeployRoot 'config.env')
Assert-Command aws
Assert-Command npm

$appId = $env:AMPLIFY_APP_ID
$branch = if ($env:AMPLIFY_BRANCH) { $env:AMPLIFY_BRANCH } else { 'staging' }
$region = if ($env:AMPLIFY_REGION) { $env:AMPLIFY_REGION } else { 'ap-south-1' }
$env:AWS_DEFAULT_REGION = $region
$apiUrl = $env:VITE_API_URL
if (-not $apiUrl) { throw 'VITE_API_URL is required in config.env' }

function Test-AmplifyApp([string]$Id, [string]$Reg) {
  if (-not $Id) { return $false }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  aws amplify get-app --app-id $Id --region $Reg 1>$null 2>$null
  $ok = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $prev
  return $ok
}

if (-not $appId -or -not (Test-AmplifyApp $appId $region)) {
  if ($appId -and -not $CreateApp) {
    Write-Host @"
Amplify app '$appId' was not found in region $region for the current AWS identity.
Amplify is regional — confirm AMPLIFY_REGION=ap-south-1 in config.env and that your
AWS credentials belong to account 497645775287.

Options:
  1) Set AMPLIFY_REGION=ap-south-1 (or export AWS_DEFAULT_REGION)
  2) Re-run with -CreateApp to create 'mijnlevenspad' in this account/region
"@ -ForegroundColor Yellow
    throw "Amplify app not found: $appId"
  }
  if (-not $CreateApp -and -not $appId) {
    Write-Host "AMPLIFY_APP_ID empty - creating 'mijnlevenspad' in $region (use -CreateApp explicitly next time)" -ForegroundColor Yellow
    $doCreate = $true
  } else {
    $doCreate = [bool]$CreateApp
  }
  if ($doCreate) {
    Write-Host "==> Creating Amplify app 'mijnlevenspad' in $region" -ForegroundColor Cyan
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $createOut = aws amplify create-app `
      --name mijnlevenspad `
      --platform WEB `
      --region $region `
      --output json 2>&1
    $createCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($createCode -ne 0) {
      throw @"
Failed to create Amplify app (exit $createCode):
$createOut

This AWS account may be at the Amplify app limit. Set AMPLIFY_APP_ID in config.env to an existing app you can overwrite, or free a slot / use the account that owns dutgt85z7f3h6.
"@
    }
    $createdApp = $createOut | ConvertFrom-Json
    $appId = $createdApp.app.appId
    if (-not $appId) { throw "create-app did not return appId: $createOut" }
    $env:AMPLIFY_APP_ID = $appId
    Write-Host "Created appId=$appId domain=https://$branch.$appId.amplifyapp.com"
    aws amplify create-branch --app-id $appId --branch-name $branch --region $region 2>$null | Out-Null
    $env:AMPLIFY_APP_ID = $appId
    $env:AMPLIFY_REGION = $region
    python (Join-Path $DeployRoot 'update-amplify-spa-rules.py') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Failed to set Amplify SPA rewrite rules' }

    $cfg = Join-Path $DeployRoot 'config.env'
    if (Test-Path -LiteralPath $cfg) {
      $text = Get-Content -LiteralPath $cfg -Raw
      if ($text -match '(?m)^AMPLIFY_APP_ID=') {
        $text = [regex]::Replace($text, '(?m)^AMPLIFY_APP_ID=.*$', "AMPLIFY_APP_ID=$appId")
      } else {
        $text = "AMPLIFY_APP_ID=$appId`n" + $text
      }
      if ($text -notmatch '(?m)^FRONTEND_HEALTH_URL=.+') {
        $text = [regex]::Replace($text, '(?m)^FRONTEND_HEALTH_URL=.*$', "FRONTEND_HEALTH_URL=https://$branch.$appId.amplifyapp.com/")
      }
      Set-Content -LiteralPath $cfg -Value $text -NoNewline
    }
  }
}

if (-not $appId) { throw 'AMPLIFY_APP_ID is required' }

# S3 301s /path -> /path/; status 200 rewrite serves index.html for all SPA routes.
Write-Host "==> Ensuring Amplify SPA rewrite rules" -ForegroundColor Cyan
$env:AMPLIFY_APP_ID = $appId
$env:AMPLIFY_REGION = $region
python (Join-Path $DeployRoot 'update-amplify-spa-rules.py') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to update Amplify SPA rewrite rules' }

$ErrorActionPreference = 'Continue'
aws amplify get-branch --app-id $appId --branch-name $branch --region $region 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  aws amplify create-branch --app-id $appId --branch-name $branch --region $region | Out-Null
}
$ErrorActionPreference = 'Stop'

$root = Get-RepoRoot
if (-not $root) { throw 'Get-RepoRoot returned empty' }
$dist = Join-Path -Path $root -ChildPath 'dist'
$zipPath = Join-Path -Path $env:TEMP -ChildPath ("inner-amplify-{0}.zip" -f (Get-Date -Format 'yyyyMMddHHmmss'))
Write-Host "==> Repo root: $root" -ForegroundColor DarkGray

Push-Location $root
try {
  if (-not $SkipBuild) {
    Write-Host "==> Building frontend (VITE_API_URL=$apiUrl)" -ForegroundColor Cyan
    $env:VITE_API_URL = $apiUrl
    # Do NOT set NODE_ENV=production before npm install - skips TypeScript/devDeps.
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    if (-not (Test-Path -LiteralPath (Join-Path -Path $root -ChildPath 'node_modules'))) {
      if (Test-Path -LiteralPath (Join-Path -Path $root -ChildPath 'package-lock.json')) { npm ci } else { npm install }
    } else {
      Write-Host "    using existing node_modules (skip npm ci)"
    }
    npm run build
  }

  $indexHtml = Join-Path -Path $dist -ChildPath 'index.html'
  if (-not (Test-Path -LiteralPath $indexHtml)) {
    throw "dist/index.html missing. Build failed or SkipBuild without dist."
  }

  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  Write-Host "==> Zipping $dist -> $zipPath (forward-slash paths for Amplify)" -ForegroundColor Cyan
  # Compress-Archive uses backslashes in entry names; Amplify/Linux then 404s /assets/*.
  $py = Join-Path $root 'backend\.venv\Scripts\python.exe'
  if (-not (Test-Path -LiteralPath $py)) { $py = 'python' }
  & $py -c @"
import zipfile
from pathlib import Path
root = Path(r'''$dist''')
out = Path(r'''$zipPath''')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    count = 0
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        zf.write(path, rel)
        count += 1
print(f'zipped {count} files -> {out}')
"@
  if (-not (Test-Path -LiteralPath $zipPath)) { throw 'Failed to create Amplify zip' }

  Write-Host "==> Creating Amplify deployment ($appId / $branch)" -ForegroundColor Cyan
  $created = aws amplify create-deployment `
    --app-id $appId `
    --branch-name $branch `
    --region $region `
    --output json | ConvertFrom-Json

  $jobId = $created.jobId
  $uploadUrl = $created.zipUploadUrl
  if (-not $jobId -or -not $uploadUrl) {
    throw "create-deployment did not return jobId/zipUploadUrl: $($created | ConvertTo-Json -Compress)"
  }

  Write-Host "==> Uploading zip (job $jobId)" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $uploadUrl -Method Put -InFile $zipPath -ContentType 'application/zip' -UseBasicParsing | Out-Null

  Write-Host "==> Starting deployment" -ForegroundColor Cyan
  aws amplify start-deployment `
    --app-id $appId `
    --branch-name $branch `
    --job-id $jobId `
    --region $region | Out-Null

  Write-Host "==> Waiting for Amplify job $jobId" -ForegroundColor Cyan
  $deadline = (Get-Date).AddMinutes(20)
  $status = 'PENDING'
  do {
    Start-Sleep -Seconds 8
    $job = aws amplify get-job `
      --app-id $appId `
      --branch-name $branch `
      --job-id $jobId `
      --region $region `
      --output json | ConvertFrom-Json
    $status = $job.job.summary.status
    Write-Host "    status=$status"
    if ($status -in @('SUCCEED', 'FAILED', 'CANCELLED')) { break }
  } while ((Get-Date) -lt $deadline)

  if ($status -ne 'SUCCEED') {
    throw "Amplify deploy finished with status=$status (job $jobId)"
  }

  $frontUrl = if ($env:FRONTEND_HEALTH_URL) { $env:FRONTEND_HEALTH_URL } else { "https://$branch.$appId.amplifyapp.com/" }
  Write-Host "Frontend deployed: $frontUrl (app $appId / $branch)" -ForegroundColor Green
  Wait-HttpOk -Url $frontUrl -Attempts 8 -DelaySec 8
} finally {
  Pop-Location
  if ($zipPath -and (Test-Path -LiteralPath $zipPath)) {
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
  }
}
