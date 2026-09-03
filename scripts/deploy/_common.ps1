# Load scripts/deploy/config.env into process env (KEY=VALUE, # comments).
function Import-DeployConfig {
  param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.env')
  )
  if (-not (Test-Path $ConfigPath)) {
    $example = Join-Path $PSScriptRoot 'config.example.env'
    throw @"
Missing $ConfigPath

Copy the example and edit:
  Copy-Item '$example' '$ConfigPath'
"@
  }
  Get-Content $ConfigPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if (
      ($val.StartsWith('"') -and $val.EndsWith('"')) -or
      ($val.StartsWith("'") -and $val.EndsWith("'"))
    ) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    Set-Item -Path "Env:$key" -Value $val
  }
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Wait-HttpOk {
  param(
    [Parameter(Mandatory)][string]$Url,
    [int]$Attempts = 12,
    [int]$DelaySec = 5
  )
  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) {
        Write-Host "OK $Url ($($r.StatusCode))" -ForegroundColor Green
        return
      }
    } catch {
      Write-Host "Waiting for $Url ($i/$Attempts)..."
    }
    Start-Sleep -Seconds $DelaySec
  }
  throw "Health check failed: $Url"
}

function Get-DeployScriptRoot {
  if ($script:DeployRoot) { return $script:DeployRoot }
  if ($PSScriptRoot) { return $PSScriptRoot }
  throw 'Deploy script root unknown. Set $script:DeployRoot before calling Get-RepoRoot.'
}

function Get-RepoRoot {
  $deploy = Get-DeployScriptRoot
  $resolved = Resolve-Path (Join-Path $deploy '..\..')
  if (-not $resolved) { throw "Could not resolve repo root from deploy dir: $deploy" }
  return $resolved.Path
}

function Convert-PpkToOpenSsh {
  param(
    [Parameter(Mandatory)][string]$PpkPath,
    [string]$OutPem = (Join-Path $env:USERPROFILE '.ssh\mijnlevenspad-ec2-clean.pem')
  )
  if (-not (Test-Path $PpkPath)) { throw "PPK not found: $PpkPath" }

  $repoRoot = Get-RepoRoot
  $py = Join-Path $repoRoot 'backend\.venv\Scripts\python.exe'
  if (-not (Test-Path $py)) { $py = 'python' }

  & $py -m pip install puttykeys -q 2>$null | Out-Null
  $code = @"
from puttykeys import ppkraw_to_openssh
from pathlib import Path
raw = Path(r'''$PpkPath''').read_text(encoding='utf-8', errors='ignore')
openssh = ppkraw_to_openssh(raw)
out = Path(r'''$OutPem''')
out.parent.mkdir(parents=True, exist_ok=True)
text = openssh.replace('\r\n', '\n').strip() + '\n'
out.write_bytes(text.encode('utf-8'))
print(out)
"@
  $written = & $py -c $code
  $pem = "$written".Trim()
  if (-not (Test-Path $pem)) { throw 'PPK conversion failed' }

  # OpenSSH on Windows rejects keys with extra ACEs - keep only current user SID
  $uid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl = New-Object System.Security.AccessControl.FileSecurity
  $acl.SetAccessRuleProtection($true, $false)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($uid, 'FullControl', 'Allow')
  $acl.AddAccessRule($rule)
  [System.IO.File]::SetAccessControl($pem, $acl)
  return $pem
}

function Resolve-Ec2SshKey {
  $key = $env:EC2_SSH_KEY
  $ppk = $env:EC2_PPK_KEY
  if ((-not $key -or -not (Test-Path $key)) -and $ppk -and (Test-Path $ppk)) {
    Write-Host "==> Converting PPK -> OpenSSH PEM" -ForegroundColor Cyan
    $key = Convert-PpkToOpenSsh -PpkPath $ppk
    $env:EC2_SSH_KEY = $key
  }
  if (-not $key -or -not (Test-Path $key)) {
    throw "EC2_SSH_KEY missing or not found: '$key' (set EC2_PPK_KEY to auto-convert a .ppk)"
  }
  return $key
}
