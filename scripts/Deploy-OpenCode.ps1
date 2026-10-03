# Activate an already tested dashboard build and add only the owner-only gateway.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Administrator approval is required.'}
if(-not(Test-Path '.next-staging\BUILD_ID')){throw 'Tested staging dashboard build is missing.'}
if(Get-Service WydrianOpenCodeGateway -ErrorAction SilentlyContinue){throw 'Gateway already exists; this first-install script does not overwrite services.'}
& '.runtime\caddy\caddy.exe' validate --config 'deploy\Caddyfile' --adapter caddyfile
if($LASTEXITCODE -ne 0){throw 'Caddy configuration did not validate.'}
$backupDir=Join-Path $root ('.runtime\opencode-deployment\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
if(Test-Path -LiteralPath $backupDir){throw 'Deployment backup directory already exists.'}
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$me=[Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $backupDir /inheritance:r /grant:r "${me}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot protect deployment backup.'}
$envFile=Join-Path $root '.env.local'
Copy-Item -LiteralPath $envFile -Destination (Join-Path $backupDir '.env.local.previous')
Start-Transcript -Path (Join-Path $root 'logs\opencode-deployment.log') -Append | Out-Null
try{
  $content=[IO.File]::ReadAllText($envFile)
  if($content -match '(?m)^OPENCODE_WEB_ENABLED='){$content=[regex]::Replace($content,'(?m)^OPENCODE_WEB_ENABLED=.*$','OPENCODE_WEB_ENABLED=true')}
  else{$content+="`r`nOPENCODE_WEB_ENABLED=true`r`n"}
  [IO.File]::WriteAllText($envFile,$content,(New-Object Text.UTF8Encoding $false))
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\Activate-Build.ps1')
  if($LASTEXITCODE -ne 0){throw 'Dashboard activation failed.'}
  & (Join-Path $root 'scripts\Install-OpenCode-Gateway.ps1') -ServiceStateFile (Join-Path $HOME '.local\state\opencode\service.json')
  Restart-Service WydrianHttps
  Get-Service WydrianDashboard,WydrianHttps,WydrianPokemon,WydrianOpenCodeGateway | Format-Table Name,Status
  [IO.File]::WriteAllText((Join-Path $backupDir 'result.json'),(@{success=$true;finishedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
}catch{
  Copy-Item -LiteralPath (Join-Path $backupDir '.env.local.previous') -Destination $envFile -Force
  Stop-Service WydrianOpenCodeGateway -ErrorAction SilentlyContinue
  Restart-Service WydrianDashboard -ErrorAction SilentlyContinue
  [IO.File]::WriteAllText((Join-Path $backupDir 'result.json'),(@{success=$false;finishedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
  throw
}finally{Stop-Transcript -ErrorAction SilentlyContinue | Out-Null}
