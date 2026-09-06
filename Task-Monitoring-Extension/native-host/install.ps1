<#
  Registers the HumanCare Connect native messaging host for Chrome and/or Edge
  on THIS machine, for the CURRENT user (HKCU). Run from a normal PowerShell
  (no admin needed).

  Usage:
    .\install.ps1 -ChromeId <id>                     # Chrome only
    .\install.ps1 -EdgeId <id>                       # Edge only
    .\install.ps1 -ChromeId <id> -EdgeId <id>        # both

  Get the ids from chrome://extensions and edge://extensions after loading the
  built dist/ folder unpacked (Developer mode -> Load unpacked).

  What it does:
    - writes native-host.bat + co.humancareconnect.monitoring.json to
      %LOCALAPPDATA%\HumanCareMonitoring\
    - points the .bat at this repo's src/monitoring/extension/nativeHost.js,
      run with the node.exe currently on PATH
    - sets HKCU\...\NativeMessagingHosts\co.humancareconnect.monitoring
#>

param(
    [string]$ChromeId,
    [string]$EdgeId
)

$ErrorActionPreference = "Stop"

if (-not $ChromeId -and -not $EdgeId) {
    Write-Error "Give -ChromeId and/or -EdgeId (from chrome://extensions / edge://extensions)."
    exit 1
}

$HostName = "co.humancareconnect.monitoring"

# repo layout: this script is at Task-Monitoring-Extension\native-host\install.ps1
$RepoRoot   = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$NativeHostJs = Join-Path $RepoRoot "Task-Monitoring-Agent\src\monitoring\extension\nativeHost.js"
if (-not (Test-Path $NativeHostJs)) {
    Write-Error "nativeHost.js not found at $NativeHostJs - run this from inside the repo."
    exit 1
}

$NodeExe = (Get-Command node -ErrorAction Stop).Source

$InstallDir = Join-Path $env:LOCALAPPDATA "HumanCareMonitoring"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$BatPath      = Join-Path $InstallDir "native-host.bat"
$ManifestPath = Join-Path $InstallDir "$HostName.json"

# --- the .bat Chrome/Edge will launch ---------------------------------------
@"
@echo off
"$NodeExe" "$NativeHostJs" %*
"@ | Set-Content -Path $BatPath -Encoding ascii

# --- the native messaging host manifest ------------------------------------
$origins = @()
if ($ChromeId) { $origins += "chrome-extension://$ChromeId/" }
if ($EdgeId)   { $origins += "chrome-extension://$EdgeId/" }

$manifest = [ordered]@{
    name            = $HostName
    description     = "HumanCare Connect monitoring bridge"
    path            = $BatPath
    type            = "stdio"
    allowed_origins = $origins
}
($manifest | ConvertTo-Json -Depth 4) | Set-Content -Path $ManifestPath -Encoding ascii

# --- registry (HKCU, per-user, no admin) ----------------------------------
if ($ChromeId) {
    $k = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
    New-Item -Path $k -Force | Out-Null
    Set-ItemProperty -Path $k -Name "(default)" -Value $ManifestPath
    Write-Host "Chrome  -> $k"
}
if ($EdgeId) {
    $k = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
    New-Item -Path $k -Force | Out-Null
    Set-ItemProperty -Path $k -Name "(default)" -Value $ManifestPath
    Write-Host "Edge    -> $k"
}

Write-Host ""
Write-Host "Installed:"
Write-Host "  $BatPath"
Write-Host "  $ManifestPath"
Write-Host ""
Write-Host "allowed_origins:"
$origins | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Restart Chrome/Edge completely (all windows) so it picks up the host."
