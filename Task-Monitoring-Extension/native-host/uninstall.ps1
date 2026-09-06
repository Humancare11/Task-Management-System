<#
  Removes the HumanCare Connect native messaging host registration for the
  current user. Run from a normal PowerShell.
#>

$ErrorActionPreference = "SilentlyContinue"
$HostName = "co.humancareconnect.monitoring"

Remove-Item -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName" -Force
Remove-Item -Path "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName" -Force

$InstallDir = Join-Path $env:LOCALAPPDATA "HumanCareMonitoring"
Remove-Item -Path (Join-Path $InstallDir "native-host.bat") -Force
Remove-Item -Path (Join-Path $InstallDir "$HostName.json") -Force

Write-Host "Removed the native messaging host registration (Chrome + Edge) and its files."
