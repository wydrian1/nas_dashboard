# Prepares a credential-free native Task Scheduler import; never installs/restarts media servers.
param([Parameter(Mandatory=$true)][string]$ExpectedRunnerSha256,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
$root='D:\!nas'
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
if($identity.User.Value -eq 'S-1-5-18'){throw 'Original Windows user required'}
$runner=Join-Path $PSScriptRoot 'Start-MediaServers.ps1'
if($ExpectedRunnerSha256 -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $runner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedRunnerSha256){throw 'Reviewed runner required'}
$name='WydrianMediaStartup'
if(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue){throw 'Media startup task already exists; refusing overwrite'}
$servers=@()
foreach($app in @(@{name='plex';exe=(Join-Path $env:ProgramFiles 'Plex\Plex Media Server\Plex Media Server.exe')},@{name='jellyfin';exe=(Join-Path $env:ProgramFiles 'Jellyfin\Server\jellyfin.exe')})){
  $processes=@(Get-CimInstance Win32_Process -Filter ("Name='"+[IO.Path]::GetFileName($app.exe)+"'"))
  if($processes.Count -ne 1 -or $processes[0].ExecutablePath -ne $app.exe -or (Invoke-CimMethod -InputObject $processes[0] -MethodName GetOwnerSid).Sid -ne $identity.User.Value){throw 'One original-user server required for each app'}
  $tokens=@([regex]::Matches($processes[0].CommandLine,'"[^"\r\n]*"|[^\s]+') | ForEach-Object {$_.Value.Trim('"')})
  if($app.name -eq 'plex'){
    if($processes[0].CommandLine.Trim() -ne $app.exe -and $processes[0].CommandLine.Trim() -ne ('"'+$app.exe+'"')){throw 'Custom Plex arguments need separate review'}
    $dataPath=Join-Path $env:LOCALAPPDATA 'Plex Media Server';$port=32400
    $response=Invoke-WebRequest 'http://127.0.0.1:32400/identity' -UseBasicParsing -TimeoutSec 5
    [xml]$info=$response.Content
    if($response.StatusCode -ne 200 -or -not $info.MediaContainer.machineIdentifier -or $info.MediaContainer.claimed -ne '1'){throw 'Existing claimed Plex server required'}
    $serverId=[string]$info.MediaContainer.machineIdentifier
  } else {
    if($tokens.Count -ne 3 -or $tokens[1] -ne '--datadir'){throw 'Explicit original Jellyfin datadir required; other arguments need separate review'}
    $dataPath=$tokens[2]
    [xml]$network=Get-Content -LiteralPath (Join-Path $dataPath 'config\network.xml') -Raw
    $https=$network.SelectSingleNode('//*[local-name()="RequireHttps"]').InnerText -eq 'true'
    $port=[int]$network.SelectSingleNode('//*[local-name()="'+$(if($https){'InternalHttpsPort'}else{'InternalHttpPort'})+'"]').InnerText
    $serverId=$null
  }
  if(-not @((Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) | Where-Object OwningProcess -eq $processes[0].ProcessId).Count){throw 'Original server listener required'}
  $servers+=@{name=$app.name;executable=$app.exe;dataPath=$dataPath;port=$port;serverId=$serverId;originalPid=$processes[0].ProcessId}
}
if($CheckOnly){@{passed=$true;checkOnly=$true;originalUser=$true;bothServersRunning=$true;noTaskFilesOrServersChanged=$true} | ConvertTo-Json -Compress;exit 0}
$directory=Join-Path $root ('.runtime\media-autostart\releases\'+$ExpectedRunnerSha256+'-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $directory | Out-Null
& icacls.exe $directory /inheritance:r /grant:r ($identity.Name+':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot protect private media startup release'}
$installedRunner=Join-Path $directory 'Start-MediaServers.ps1'
Copy-Item -LiteralPath $runner -Destination $installedRunner
if((Get-FileHash $installedRunner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedRunnerSha256){throw 'Runner changed during preparation'}
$settingsPath=Join-Path $directory 'settings.json'
@{root=$root;userSid=$identity.User.Value;userProfile=$env:USERPROFILE;servers=$servers} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $settingsPath
$hash=(Get-FileHash $settingsPath -Algorithm SHA256).Hash.ToLowerInvariant()
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $installedRunner -SettingsPath $settingsPath -ExpectedSettingsSha256 $hash -CheckOnly
if($LASTEXITCODE -ne 0){throw 'Existing media profile/process guard failed; no task installed'}
$scheduler=New-Object -ComObject 'Schedule.Service';$scheduler.Connect()
$task=$scheduler.NewTask(0)
$task.RegistrationInfo.URI='\'+$name
$task.RegistrationInfo.Description='Original-user Plex and Jellyfin startup before Windows sign-in; preserve existing media profiles, never launch duplicates or restart healthy servers.'
$task.Principal.UserId=$identity.Name;$task.Principal.LogonType=1;$task.Principal.RunLevel=0
$task.Settings.Enabled=$true;$task.Settings.StartWhenAvailable=$true;$task.Settings.MultipleInstances=2
$task.Settings.ExecutionTimeLimit='PT0S' # Do not time-limit/kill long-lived spawned media servers.
$task.Settings.RestartInterval='PT1M';$task.Settings.RestartCount=3
$task.Settings.DisallowStartIfOnBatteries=$false;$task.Settings.StopIfGoingOnBatteries=$false
$trigger=$task.Triggers.Create(8);$trigger.Enabled=$true;$trigger.Delay='PT60S'
$action=$task.Actions.Create(0)
$action.Path=Join-Path $env:windir 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$installedRunner+'" -SettingsPath "'+$settingsPath+'" -ExpectedSettingsSha256 '+$hash
$action.WorkingDirectory=$root
$taskPath=Join-Path $directory ($name+'.xml')
[IO.File]::WriteAllText($taskPath,$task.XmlText,[Text.Encoding]::Unicode)
$result=@{prepared=$true;task=$name;taskXml=$taskPath;release=$directory;bootDelaySeconds=60;logonType='Password';runLevel='Limited';noTaskRegistered=$true;noCredentialAttempts=$true;originalServersNotRestarted=$true;loginStartupEntriesUntouched=$true}
$result | ConvertTo-Json | Set-Content (Join-Path $directory 'prepared.json')
$result | ConvertTo-Json -Compress
