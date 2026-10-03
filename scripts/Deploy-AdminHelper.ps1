param([Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBinarySha256)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'One-time local UAC approval is required.'}
if(-not(Test-Path '.next-staging\BUILD_ID')){throw 'Tested staging dashboard build is missing.'}
$backup=Join-Path $root ('.runtime\admin-helper-installation\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
if(Test-Path -LiteralPath $backup){throw 'Deployment backup directory exists.'}
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$me=[Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $backup /inheritance:r /grant:r "${me}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot protect deployment backup.'}
$envFile=Join-Path $root '.env.local'
Copy-Item -LiteralPath $envFile -Destination (Join-Path $backup '.env.local.previous')
try{
  & (Join-Path $root 'scripts\Install-AdminHelper.ps1') -ExpectedBinarySha256 $ExpectedBinarySha256
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\Activate-Build.ps1')
  if($LASTEXITCODE -ne 0){throw 'Dashboard activation failed.'}
  Get-Service WydrianAdminHelper,WydrianDashboard,WydrianHttps,WydrianPokemon,WydrianOpenCodeGateway | Format-Table Name,Status
  [IO.File]::WriteAllText((Join-Path $backup 'result.json'),(@{success=$true;finishedAt=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
}catch{
  Copy-Item -LiteralPath (Join-Path $backup '.env.local.previous') -Destination $envFile -Force
  Stop-Service WydrianAdminHelper -ErrorAction SilentlyContinue
  Set-Service WydrianAdminHelper -StartupType Disabled -ErrorAction SilentlyContinue
  Restart-Service WydrianDashboard -ErrorAction SilentlyContinue
  [IO.File]::WriteAllText((Join-Path $backup 'result.json'),(@{success=$false;finishedAt=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
  throw
}
