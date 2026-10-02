$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
& (Join-Path $PSScriptRoot 'Activate-Build.ps1')
& (Join-Path $PSScriptRoot 'Install-Pokemon-Worker.ps1')
Write-Output 'Dashboard and Pokemon worker deployed. Notifications use Firebase push only.'
