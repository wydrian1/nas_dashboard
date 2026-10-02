$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator approval is required.' }
if (-not (Test-Path '.next-staging\BUILD_ID')) { throw 'Tested staging build is required.' }
$node = Get-ChildItem '.runtime' -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1
& (Join-Path $node.FullName 'node.exe') --experimental-strip-types 'scripts\Import-Lego.ts' --input '.runtime\research\lego-source.json' --database 'data\dashboard.sqlite' --actor 'wydrian@gmail.com' --commit
if ($LASTEXITCODE -ne 0) { throw 'LEGO list import failed; existing build remains active.' }
& (Join-Path $PSScriptRoot 'Activate-Build.ps1')
