$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
& (Join-Path $root '.runtime\caddy\caddy.exe') run --config (Join-Path $root 'deploy\Caddyfile') --adapter caddyfile
exit $LASTEXITCODE
