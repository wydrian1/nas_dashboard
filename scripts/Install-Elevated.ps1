$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Path (Join-Path $root 'logs') -Force | Out-Null
Start-Transcript -Path (Join-Path $root 'logs\installation.log') -Append | Out-Null
try {
    & (Join-Path $PSScriptRoot 'Install-Services.ps1') -StopTrialProcesses
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Stop-Transcript | Out-Null
    Read-Host 'A telepites hibaval leallt. Enter a bezarashoz'
    exit 1
}
Stop-Transcript | Out-Null
