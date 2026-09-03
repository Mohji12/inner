<#
.SYNOPSIS
  Deploy backend (EC2) then frontend (Amplify).

.EXAMPLE
  .\scripts\deploy\deploy-all.ps1
  .\scripts\deploy\deploy-all.ps1 -FrontendOnly -CreateAmplifyApp
  .\scripts\deploy\deploy-all.ps1 -BackendOnly
#>
[CmdletBinding()]
param(
  [switch]$FrontendOnly,
  [switch]$BackendOnly,
  [switch]$SkipFrontendBuild,
  [switch]$CreateAmplifyApp,
  [switch]$ProbeBackendOnly
)

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

if ($ProbeBackendOnly) {
  & (Join-Path $here 'deploy-backend.ps1') -ProbeOnly
  return
}

if (-not $FrontendOnly) {
  & (Join-Path $here 'deploy-backend.ps1')
}

if (-not $BackendOnly) {
  $feArgs = @{}
  if ($SkipFrontendBuild) { $feArgs.SkipBuild = $true }
  if ($CreateAmplifyApp) { $feArgs.CreateApp = $true }
  & (Join-Path $here 'deploy-frontend.ps1') @feArgs
}

Write-Host "`nAll requested deploys finished." -ForegroundColor Green
