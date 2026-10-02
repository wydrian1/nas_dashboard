param([switch]$Development)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$node = Get-ChildItem (Join-Path $root '.runtime') -Directory -Filter 'node-v24*-win-x64' | Sort-Object Name -Descending | Select-Object -First 1
if (-not $node) { throw 'A projekt helyi Node.js futtatókörnyezete hiányzik.' }
$env:PATH = "$($node.FullName);$env:PATH"
$command = if ($Development) { 'dev' } else { 'start' }
& (Join-Path $node.FullName 'npm.cmd') run $command
exit $LASTEXITCODE
