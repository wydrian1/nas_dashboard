# Activate a tested combined release. No credential output or finance database writes.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Local administrator approval is required.'}
if(-not(Test-Path '.next-staging\BUILD_ID')){throw 'Tested staging build is missing.'}
if(-not(Test-Path '.runtime\secrets\etoro.json')){throw 'Private eToro credentials have not been configured.'}
# Never replace the already deployed helper UI with a main-only build.
if(-not(Test-Path 'app\api\admin-helper\route.ts')){throw 'The combined release must preserve the deployed admin helper source.'}
$stageRoute=Get-ChildItem '.next-staging\server\app\api\admin-helper' -Filter 'route.js' -ErrorAction SilentlyContinue
if(-not $stageRoute){throw 'The staging release is missing the admin helper API.'}
$backup=Join-Path $root ('.runtime\etoro-deployment\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
if(Test-Path -LiteralPath $backup){throw 'Deployment backup directory already exists.'}
New-Item -ItemType Directory -Path $backup -Force | Out-Null
& icacls.exe $backup /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Could not protect the previous configuration.'}
$envFile=Join-Path $root '.env.local'
$previous=[IO.File]::ReadAllBytes($envFile)
[IO.File]::WriteAllBytes((Join-Path $backup '.env.local.previous'),$previous)
$text=[Text.Encoding]::UTF8.GetString($previous)
if($text -notmatch '(?m)^ADMIN_HELPER_ENABLED=true\r?$'){throw 'The deployed helper must stay enabled.'}
$updated=if($text -match '(?m)^FINANCE_ETORO_ENABLED='){[regex]::Replace($text,'(?m)^FINANCE_ETORO_ENABLED=[^\r\n]*','FINANCE_ETORO_ENABLED=true')}else{$text+"`r`nFINANCE_ETORO_ENABLED=true`r`n"}
try{
  [IO.File]::WriteAllText($envFile,$updated,(New-Object Text.UTF8Encoding $false))
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\Activate-Build.ps1')
  if($LASTEXITCODE -ne 0){throw 'Activation failed; the previous build was restored.'}
  [IO.File]::WriteAllText((Join-Path $backup 'result.json'),(@{success=$true;finishedAt=(Get-Date).ToUniversalTime().ToString('o');buildId=([IO.File]::ReadAllText((Join-Path $root '.next\BUILD_ID'))).Trim()}|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
}catch{
  [IO.File]::WriteAllBytes($envFile,$previous)
  Restart-Service WydrianDashboard -ErrorAction SilentlyContinue
  [IO.File]::WriteAllText((Join-Path $backup 'result.json'),(@{success=$false;finishedAt=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
  throw
}
