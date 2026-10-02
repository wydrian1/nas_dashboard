# Activate a previously tested staging build, with rollback if startup fails.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator approval is required.' }
if (-not (Test-Path '.next-staging\BUILD_ID')) { throw 'Staging build is missing.' }
$backup = '.next-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
if (Test-Path $backup) { throw 'Backup exists; do not overwrite it.' }
New-Item -ItemType Directory -Path 'logs' -Force | Out-Null
Start-Transcript -Path 'logs\activation.log' -Append | Out-Null
$oldMoved = $false
$newMoved = $false
try {
    Stop-Service WydrianDashboard
    $node = Get-ChildItem (Join-Path $root '.runtime') -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1
    & (Join-Path $node.FullName 'node.exe') (Join-Path $root 'scripts\Backup-Database.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Database backup failed; activation cancelled.' }
    Move-Item -LiteralPath '.next' -Destination $backup
    $oldMoved = $true
    Move-Item -LiteralPath '.next-staging' -Destination '.next'
    $newMoved = $true
    New-Item -ItemType Directory -Path '.next\cache' -Force | Out-Null
    & icacls.exe (Join-Path $root '.next') /grant '*S-1-5-19:(OI)(CI)RX' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Build read permission could not be set.' }
    & icacls.exe (Join-Path $root '.next\cache') /grant '*S-1-5-19:(OI)(CI)M' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cache write permission could not be set.' }
    Start-Service WydrianDashboard
    $healthy = $false
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        try {
            $r = Invoke-WebRequest 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { $healthy = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $healthy) { throw 'New build did not pass the startup health check.' }
    $declarations = Join-Path $root 'next-env.d.ts'
    $text = [IO.File]::ReadAllText($declarations).Replace('./.next-staging/', './.next/')
    [IO.File]::WriteAllText($declarations, $text, (New-Object Text.UTF8Encoding $false))
    Write-Output "Dashboard update activated. Previous build retained in $backup."
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Stop-Service WydrianDashboard -ErrorAction SilentlyContinue
    if ($newMoved) { Move-Item -LiteralPath '.next' -Destination '.next-staging' }
    if ($oldMoved) { Move-Item -LiteralPath $backup -Destination '.next' }
    Start-Service WydrianDashboard
    Stop-Transcript | Out-Null
    Read-Host 'Update failed; previous build restored. Press Enter to close'
    exit 1
}
Stop-Transcript | Out-Null
