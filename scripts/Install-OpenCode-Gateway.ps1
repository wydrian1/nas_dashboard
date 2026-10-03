param([string]$ServiceStateFile=(Join-Path $HOME '.local\state\opencode\service.json'))
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Administrator approval is required.'}
if(Get-Service WydrianOpenCodeGateway -ErrorAction SilentlyContinue){throw 'Gateway service already exists; do not overwrite it.'}
if(-not(Test-Path -LiteralPath $ServiceStateFile)){throw 'Existing OpenCode service state was not found.'}
if(Get-NetTCPConnection -State Listen -LocalPort 3101 -ErrorAction SilentlyContinue){throw 'Loopback port 3101 is already in use.'}
$node=(Get-ChildItem (Join-Path $root '.runtime') -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1).FullName+'\node.exe'
$services=Join-Path $root '.runtime\services'
$wrapper=Join-Path $services 'winsw.exe'
if(-not(Test-Path -LiteralPath $wrapper)){throw 'Existing verified WinSW wrapper was not found.'}
$settingsDir=Join-Path $root '.runtime\opencode-gateway'
New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null
$me=[Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $settingsDir /inheritance:r /grant:r "${me}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot protect gateway configuration.'}
[IO.File]::WriteAllText((Join-Path $settingsDir 'settings.json'),(@{serviceStateFile=$ServiceStateFile}|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
$release=Join-Path $settingsDir ('releases\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
if(Test-Path -LiteralPath $release){throw 'Gateway release directory already exists.'}
foreach($folder in @('lib','scripts')){New-Item -ItemType Directory -Path (Join-Path $release $folder) -Force | Out-Null}
foreach($path in @('lib\opencode-gateway.ts','lib\opencode-policy.ts','scripts\Run-OpenCode-Gateway.mjs')){Copy-Item -LiteralPath (Join-Path $root $path) -Destination (Join-Path $release $path)}
function Escape([string]$value){[Security.SecurityElement]::Escape($value)}
$target=Join-Path $services 'WydrianOpenCodeGateway'
Copy-Item -LiteralPath $wrapper -Destination "$target.exe"
$xml=@"
<service>
  <id>WydrianOpenCodeGateway</id><name>WydrianOpenCodeGateway</name>
  <description>Owner-only loopback proxy to the existing OpenCode service; does not start or reconfigure OpenCode.</description>
  <executable>$(Escape $node)</executable>
  <arguments>--experimental-strip-types &quot;$(Escape (Join-Path $release 'scripts\Run-OpenCode-Gateway.mjs'))&quot;</arguments>
  <workingdirectory>$(Escape $root)</workingdirectory>
  <startmode>Automatic</startmode><delayedAutoStart>true</delayedAutoStart>
  <onfailure action="restart" delay="10 sec"/><stoptimeout>20 sec</stoptimeout>
  <logpath>$(Escape (Join-Path $root 'logs'))</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>3</keepFiles></log>
</service>
"@
[IO.File]::WriteAllText("$target.xml",$xml,(New-Object Text.UTF8Encoding $false))
& "$target.exe" install
if($LASTEXITCODE -ne 0){throw 'Gateway service installation failed.'}
Start-Service WydrianOpenCodeGateway
Get-Service WydrianOpenCodeGateway | Select-Object Name,Status
