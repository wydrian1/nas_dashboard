# Relocate this complete project without deleting the original; keep service identities and rollback.
param([string]$Destination='D:\!nas')
$ErrorActionPreference='Stop'
$source=Split-Path $PSScriptRoot -Parent
$destination=[IO.Path]::GetFullPath($Destination).TrimEnd('\')
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Administrator approval is required.'}
if($source -eq $destination -or $destination.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Destination must be outside the source project.'}
if(Test-Path -LiteralPath $destination){throw 'Destination already exists; refusing to overwrite it.'}
$names=@('WydrianPokemon','WydrianDashboard','WydrianHttps')
$registered=@{}
foreach($name in $names){$service=Get-CimInstance Win32_Service -Filter "Name='$name'";if(-not $service -or $service.PathName.Trim('"') -ne (Join-Path $source ".runtime\services\$name.exe")){throw 'A service does not belong to this project.'};$registered[$name]=$service}
$firewall=Get-NetFirewallRule -Name 'WydrianHttps443' | Get-NetFirewallApplicationFilter
$oldProgram=$firewall.Program
if($oldProgram -ne (Join-Path $source '.runtime\caddy\caddy.exe')){throw 'HTTPS firewall rule does not belong to this project.'}
$userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$temp=Join-Path $env:LOCALAPPDATA ('Temp\opencode\project-move-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $temp | Out-Null
Start-Transcript -Path (Join-Path $temp 'migration.log') | Out-Null
$stopped=$false;$newStarted=$false;$changed=@()
function CopyTree([string]$from,[string]$to,[switch]$Precopy){
  $arguments=@($from,$to,'/E','/COPY:DAT','/DCOPY:DAT','/R:1','/W:1','/XJ','/MT:8','/NFL','/NDL','/NP',('/LOG+:'+(Join-Path $temp 'copy.log')))
  if($Precopy){$arguments+=@('/XD',(Join-Path $from 'data'),(Join-Path $from 'logs'))}
  & robocopy.exe @arguments | Out-Null
  if($LASTEXITCODE -ge 8){throw "Project copy failed (robocopy $LASTEXITCODE)."}
}
function SetServicePath([string]$name,[string]$path){
  $service=Get-CimInstance Win32_Service -Filter "Name='$name'"
  $result=Invoke-CimMethod -InputObject $service -MethodName Change -Arguments @{PathName=$path}
  if($result.ReturnValue -ne 0){throw "Could not update service path: $name ($($result.ReturnValue))."}
}
try{
  New-Item -ItemType Directory -Path $destination | Out-Null
  & icacls.exe $destination /inheritance:r /grant:r "*${userSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-19:(OI)(CI)RX' | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Destination permissions could not be protected.'}
  Write-Output 'Pre-copying project; production remains online.'
  CopyTree $source $destination -Precopy
  $stopped=$true
  foreach($name in $names){Stop-Service $name -ErrorAction Stop}
  Set-Location $source
  $node=Get-ChildItem (Join-Path $source '.runtime') -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1
  & (Join-Path $node.FullName 'node.exe') 'scripts\Backup-Database.mjs'
  if($LASTEXITCODE -ne 0){throw 'Database backup failed.'}
  & (Join-Path $node.FullName 'node.exe') --experimental-strip-types 'scripts\Verify-ProjectMove.ts' --capture
  if($LASTEXITCODE -ne 0){throw 'Offline preservation manifest failed.'}
  CopyTree $source $destination
  Set-Location $destination
  $newNode=Join-Path $destination ('.runtime\'+$node.Name)
  & (Join-Path $newNode 'node.exe') --experimental-strip-types 'scripts\Verify-ProjectMove.ts' --copied
  if($LASTEXITCODE -ne 0){throw 'Copied data verification failed.'}
  foreach($path in @('.env.local','.runtime\services\WydrianDashboard.xml','.runtime\services\WydrianHttps.xml','.runtime\services\WydrianPokemon.xml')){
    $full=Join-Path $destination $path
    $text=[IO.File]::ReadAllText($full).Replace($source,$destination)
    [IO.File]::WriteAllText($full,$text,(New-Object Text.UTF8Encoding $false))
  }
  foreach($folder in @('data','logs','.next\cache')){
    New-Item -ItemType Directory -Path (Join-Path $destination $folder) -Force | Out-Null
    & icacls.exe (Join-Path $destination $folder) /grant '*S-1-5-19:(OI)(CI)M' | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Service write permissions could not be set.'}
  }
  $signing=Join-Path $destination '.runtime\android-signing'
  if(Test-Path $signing){& icacls.exe $signing /inheritance:r /grant:r "*${userSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null;if($LASTEXITCODE -ne 0){throw 'Signing keys could not be protected.'}}
  foreach($name in $names){SetServicePath $name ('"'+(Join-Path $destination ".runtime\services\$name.exe")+'"');$changed+=$name}
  Get-NetFirewallRule -Name 'WydrianHttps443' | Get-NetFirewallApplicationFilter | Set-NetFirewallApplicationFilter -Program (Join-Path $destination '.runtime\caddy\caddy.exe')
  $newStarted=$true
  foreach($name in @('WydrianDashboard','WydrianHttps','WydrianPokemon')){Start-Service $name}
  $healthy=$false
  for($attempt=0;$attempt -lt 20;$attempt++){try{$response=Invoke-WebRequest 'https://nas.wydrian.hu/' -UseBasicParsing -TimeoutSec 5;if($response.StatusCode -eq 200){$healthy=$true;break}}catch{Start-Sleep -Seconds 1}}
  if(-not $healthy){throw 'Relocated dashboard failed HTTPS health check.'}
  foreach($name in $names){$current=Get-CimInstance Win32_Service -Filter "Name='$name'";if($current.State -ne 'Running' -or $current.StartName -ne $registered[$name].StartName){throw 'Service state/account changed unexpectedly.'}}
  & (Join-Path $newNode 'node.exe') --experimental-strip-types 'scripts\Verify-ProjectMove.ts' --running
  if($LASTEXITCODE -ne 0){throw 'Relocated application preservation/health verification failed.'}
  [IO.File]::WriteAllText((Join-Path $source 'MOVED-TO-D.txt'),"Active project: $destination`r`nThis original directory is retained for rollback only. Do not start services here.`r`n")
  Write-Output "Project relocated to $destination. Original retained at $source."
}catch{
  Write-Output ('Migration failed: '+$_.Exception.Message)
  if($stopped){
    foreach($name in $names){Stop-Service $name -ErrorAction SilentlyContinue}
    if($newStarted){CopyTree (Join-Path $destination 'data') (Join-Path $source 'data')}
    foreach($name in $changed){SetServicePath $name $registered[$name].PathName}
    Get-NetFirewallRule -Name 'WydrianHttps443' | Get-NetFirewallApplicationFilter | Set-NetFirewallApplicationFilter -Program $oldProgram
    foreach($name in @('WydrianDashboard','WydrianHttps','WydrianPokemon')){Start-Service $name}
  }
  Stop-Transcript | Out-Null
  exit 1
}
Stop-Transcript | Out-Null
