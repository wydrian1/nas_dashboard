# Elevated activation of the validated initial finance import and staging dashboard.
# No financial data or workbook is copied into public assets or the APK.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator approval is required.' }
if (-not (Test-Path '.next-staging\BUILD_ID')) { throw 'Validated staging build is missing.' }
$node = Get-ChildItem '.runtime' -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1
if (-not $node) { throw 'Local Node runtime is missing.' }
& (Join-Path $node.FullName 'node.exe') --experimental-strip-types 'scripts\Import-Finance.ts' --input '.runtime\research\finance-workbook.json' --database 'data\dashboard.sqlite' --commit
if ($LASTEXITCODE -ne 0) { throw 'Finance import failed; the active build was not changed.' }
& (Join-Path $PSScriptRoot 'Activate-Build.ps1')
Write-Output 'Finance imported and dashboard activated. Existing Pokemon worker and shared APK unchanged.'
