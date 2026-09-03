<#
.SYNOPSIS
  Deploy backend/ to EC2 (zip with forward-slash paths) and restart the API.

.EXAMPLE
  .\scripts\deploy\deploy-backend.ps1
  .\scripts\deploy\deploy-backend.ps1 -ProbeOnly
#>
[CmdletBinding()]
param(
  [switch]$ProbeOnly
)

$ErrorActionPreference = 'Stop'
$DeployRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $DeployRoot '_common.ps1')
$script:DeployRoot = $DeployRoot
Import-DeployConfig -ConfigPath (Join-Path $DeployRoot 'config.env')
Assert-Command ssh
Assert-Command scp

$hostName = $env:EC2_HOST
$user = if ($env:EC2_USER) { $env:EC2_USER } else { 'ubuntu' }
$remoteDir = $env:EC2_REMOTE_DIR
$service = $env:EC2_SYSTEMD_SERVICE
$venvDir = if ($env:EC2_VENV_DIR) { $env:EC2_VENV_DIR } else { '.venv' }
$migrate = if ($env:EC2_MIGRATE_SCRIPTS) { $env:EC2_MIGRATE_SCRIPTS } else { '' }

if (-not $hostName) { throw 'EC2_HOST is required in config.env' }

$key = Resolve-Ec2SshKey
$sshTarget = "${user}@${hostName}"
$sshArgs = @(
  '-i', $key,
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'IdentitiesOnly=yes',
  '-o', 'BatchMode=yes',
  '-o', 'ConnectTimeout=15'
)

Write-Host "==> Probing EC2 layout on $sshTarget" -ForegroundColor Cyan
$probe = ssh @sshArgs $sshTarget @'
set -e
echo "HOST=$(hostname)"
echo "PWD=$(pwd)"
echo "HOME=$HOME"
echo "--- services ---"
systemctl list-units --type=service --state=running --no-pager 2>/dev/null | grep -Ei 'uvicorn|gunicorn|fastapi|inner|therapy|api|celery|nginx' || true
echo "--- candidate dirs ---"
for d in "$HOME/inner-main" "$HOME/inner" "$HOME/backend" "$HOME/app" "$HOME/mijnlevenspad" /var/www/inner /opt/inner; do
  if [ -d "$d" ]; then
    echo "DIR=$d"
    ls -la "$d" 2>/dev/null | head -n 8 || true
    [ -f "$d/backend/main.py" ] && echo "HAS_BACKEND_MAIN=$d/backend/main.py"
    [ -f "$d/main.py" ] && echo "HAS_MAIN=$d/main.py"
    [ -d "$d/backend/.venv" ] && echo "HAS_VENV=$d/backend/.venv"
    [ -d "$d/.venv" ] && echo "HAS_VENV=$d/.venv"
  fi
done
find "$HOME" -maxdepth 3 -name 'main.py' 2>/dev/null | head -n 20 || true
'@

Write-Host $probe

if ($ProbeOnly) {
  Write-Host "Probe-only complete. Fill EC2_REMOTE_DIR / EC2_SYSTEMD_SERVICE in config.env." -ForegroundColor Yellow
  return
}

if (-not $remoteDir) {
  if ($probe -match 'HAS_BACKEND_MAIN=([^\r\n]+)/backend/main\.py') {
    $remoteDir = $Matches[1]
  } elseif ($probe -match 'HAS_MAIN=([^\r\n]+)/main\.py') {
    $parent = Split-Path $Matches[1] -Parent
    if ((Split-Path $Matches[1] -Leaf) -eq 'backend') {
      $remoteDir = $parent
    } else {
      $remoteDir = $Matches[1]
    }
  }
}
if (-not $remoteDir) {
  throw "EC2_REMOTE_DIR is empty and could not be auto-detected. Set it in config.env after reviewing the probe output."
}

if (-not $service -and $probe -match '(?m)^\s*(\S+\.service)\s') {
  # Prefer first matching candidate from grep lines; leave empty if unsure
  $service = ''
}

Write-Host "==> Using REMOTE_DIR=$remoteDir SERVICE=$service VENV=$venvDir" -ForegroundColor Cyan

$root = Get-RepoRoot
$localBackend = Join-Path $root 'backend'
$remoteUpdateLocal = Join-Path $DeployRoot 'remote-backend-update.sh'
$stagingZip = Join-Path $env:TEMP ("inner-backend-{0}.zip" -f (Get-Date -Format 'yyyyMMddHHmmss'))
$pyZip = Join-Path $localBackend '.venv\Scripts\python.exe'
if (-not (Test-Path $pyZip)) { $pyZip = 'python' }

Write-Host "==> Building backend zip (forward-slash paths)" -ForegroundColor Cyan
& $pyZip -c @"
import zipfile
from pathlib import Path
root = Path(r'''$localBackend''')
out = Path(r'''$stagingZip''')
skip_dirs = {'.venv', 'venv', '__pycache__', '.pytest_cache', '.git', 'uploads', 'session'}
skip_files = {'.env'}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    count = 0
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        parts = rel.split('/')
        if any(p in skip_dirs for p in parts):
            continue
        if path.name in skip_files:
            continue
        zf.write(path, 'backend/' + rel)
        count += 1
print(f'zipped {count} files -> {out}')
"@
if (-not (Test-Path $stagingZip)) { throw 'Failed to create backend zip' }

try {
  Write-Host "==> Uploading zip + remote helper" -ForegroundColor Cyan
  ssh @sshArgs $sshTarget "mkdir -p '$remoteDir/scripts/deploy' '$remoteDir/backend'"
  scp @sshArgs $stagingZip "${sshTarget}:/tmp/inner-backend.zip"
  scp @sshArgs $remoteUpdateLocal "${sshTarget}:$remoteDir/scripts/deploy/remote-backend-update.sh"
  ssh @sshArgs $sshTarget "chmod +x '$remoteDir/scripts/deploy/remote-backend-update.sh'"

  Write-Host "==> Extracting on EC2 (preserve .env / $venvDir / uploads)" -ForegroundColor Cyan
  $venvName = $venvDir
  ssh @sshArgs $sshTarget @"
set -e
python3 - <<'PY'
import zipfile, shutil
from pathlib import Path
root = Path('$remoteDir')
backend = root / 'backend'
backend.mkdir(parents=True, exist_ok=True)
keep_names = {'.env', '$venvName', '.venv', 'uploads', 'session'}
zf = zipfile.ZipFile('/tmp/inner-backend.zip')
for info in zf.infolist():
    name = info.filename.replace('\\\\', '/').lstrip('/')
    if not name or name.endswith('/'):
        continue
    # zip entries are backend/...
    parts = name.split('/')
    if len(parts) >= 2 and parts[0] == 'backend' and parts[1] in keep_names:
        continue
    dest = root / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zf.open(info) as src, open(dest, 'wb') as out:
        shutil.copyfileobj(src, out)
print('extracted', len(zf.namelist()), 'entries into', root)
zf.close()
PY
rm -f /tmp/inner-backend.zip
test -f '$remoteDir/backend/main.py' && echo HAS_MAIN_OK
"@

  Write-Host "==> Install deps + restart" -ForegroundColor Cyan
  $svcArg = if ($service) { $service } else { '' }
  ssh @sshArgs $sshTarget "bash '$remoteDir/scripts/deploy/remote-backend-update.sh' '$remoteDir' '$svcArg' '$venvDir' '$migrate'"
}
finally {
  Remove-Item $stagingZip -Force -ErrorAction SilentlyContinue
}

$health = if ($env:BACKEND_HEALTH_URL) { $env:BACKEND_HEALTH_URL } else { "https://$hostName/health" }
Wait-HttpOk -Url $health -Attempts 15 -DelaySec 4
Write-Host "Backend deploy complete." -ForegroundColor Green
