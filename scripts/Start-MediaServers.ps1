# Original-user startup only; never stops servers, changes their profiles or creates libraries.
param([Parameter(Mandatory=$true)][string]$SettingsPath,[Parameter(Mandatory=$true)][string]$ExpectedSettingsSha256,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
try {
  if($ExpectedSettingsSha256 -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $SettingsPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedSettingsSha256){throw 'settings changed'}
  $settings=Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
  if($settings.root -ne 'D:\!nas' -or $settings.userSid -ne $identity.User.Value -or $identity.User.Value -eq 'S-1-5-18' -or $env:USERPROFILE -ne $settings.userProfile -or $env:LOCALAPPDATA -ne (Join-Path $settings.userProfile 'AppData\Local')){throw 'original user required'}
  if(@($settings.servers).Count -ne 2 -or (@($settings.servers.name) | Sort-Object) -join ',' -ne 'jellyfin,plex'){throw 'exact two targets required'}
  $results=@()
  foreach($server in $settings.servers){
    try {
      if($server.name -eq 'plex'){
        $expectedExe=Join-Path $env:ProgramFiles 'Plex\Plex Media Server\Plex Media Server.exe'
        if($server.dataPath -ne (Join-Path $env:LOCALAPPDATA 'Plex Media Server') -or $server.port -ne 32400 -or -not (Test-Path -LiteralPath (Join-Path $server.dataPath 'Plug-in Support\Databases\com.plexapp.plugins.library.db')) -or -not (Test-Path 'HKCU:\Software\Plex, Inc.\Plex Media Server')){throw 'existing Plex profile required'}
        $custom=(Get-ItemProperty 'HKCU:\Software\Plex, Inc.\Plex Media Server' -Name LocalAppDataPath -ErrorAction SilentlyContinue).LocalAppDataPath
        if($custom){throw 'custom Plex profile requires separate review'}
      } elseif($server.name -eq 'jellyfin'){
        $expectedExe=Join-Path $env:ProgramFiles 'Jellyfin\Server\jellyfin.exe'
        if(-not [IO.Path]::IsPathRooted($server.dataPath) -or $server.dataPath -match '["\r\n]' -or $server.port -lt 1 -or $server.port -gt 65535 -or -not (Test-Path -LiteralPath (Join-Path $server.dataPath 'config\system.xml')) -or -not (Test-Path -LiteralPath (Join-Path $server.dataPath 'data\jellyfin.db'))){throw 'existing Jellyfin profile required'}
      } else {throw 'target'}
      if($server.executable -ne $expectedExe -or -not (Test-Path -LiteralPath $expectedExe)){throw 'original application required'}
      function Get-MediaState {
        $processes=@(Get-CimInstance Win32_Process -Filter ("Name='"+[IO.Path]::GetFileName($expectedExe)+"'"))
        if($processes.Count -gt 1){throw 'multiple original processes; owner inspection required'}
        $listeners=@(Get-NetTCPConnection -LocalPort $server.port -State Listen -ErrorAction SilentlyContinue)
        if(-not $processes.Count){if($listeners.Count){throw 'port occupied by another process'};return @{running=$false;healthy=$false}}
        $process=$processes[0]
        if($process.ExecutablePath -ne $expectedExe -or (Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid).Sid -ne $settings.userSid){throw 'different process or owner'}
        if($server.name -eq 'jellyfin'){
          $tokens=@([regex]::Matches($process.CommandLine,'"[^"\r\n]*"|[^\s]+') | ForEach-Object {$_.Value.Trim('"')})
          if($tokens.Count -ne 3 -or $tokens[1] -ne '--datadir' -or $tokens[2] -ne $server.dataPath){throw 'different Jellyfin data/arguments'}
        }
        $healthy=$listeners.Count -gt 0 -and @($listeners | Where-Object OwningProcess -ne $process.ProcessId).Count -eq 0
        if($healthy -and $server.name -eq 'plex'){
          $response=Invoke-WebRequest 'http://127.0.0.1:32400/identity' -UseBasicParsing -TimeoutSec 5
          [xml]$info=$response.Content
          $healthy=$response.StatusCode -eq 200 -and $info.MediaContainer.machineIdentifier -eq $server.serverId -and $info.MediaContainer.claimed -eq '1'
        }
        return @{running=$true;healthy=$healthy;pid=$process.ProcessId}
      }
      $state=Get-MediaState
      $alreadyRunning=$state.healthy
      if(-not $alreadyRunning){
        if($CheckOnly -or $state.running){throw 'existing server not healthy; no duplicate launch'}
        $arguments=@()
        if($server.name -eq 'jellyfin'){$arguments=@('--datadir',('"'+$server.dataPath+'"'))}
        $parameters=@{FilePath=$expectedExe;WorkingDirectory=(Split-Path $expectedExe -Parent);PassThru=$true}
        if($arguments.Count){$parameters.ArgumentList=$arguments}
        $launched=Start-Process @parameters
        $healthy=$false
        for($attempt=0;$attempt -lt 60;$attempt++){Start-Sleep -Seconds 1;$state=Get-MediaState;if($state.healthy -and $state.pid -eq $launched.Id){$healthy=$true;break}}
        if(-not $healthy){throw 'started server not healthy; no stop or replacement attempted'}
      }
      $results+=@{server=$server.name;passed=$true;alreadyRunning=$alreadyRunning;originalDataPathPreserved=$true;verification=$(if($server.name -eq 'plex'){'process-owner-port-and-server-identity'}else{'process-owner-datadir-and-listener'})}
    } catch {$results+=@{server=$server.name;passed=$false;error='Media startup guard or health check failed; no stop, profile replacement or credential logged'}}
  }
  $passed=@($results | Where-Object {-not $_.passed}).Count -eq 0
  $result=@{passed=$passed;checkOnly=[bool]$CheckOnly;servers=$results;at=(Get-Date).ToUniversalTime().ToString('o')}
  if(-not $CheckOnly){$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path (Split-Path $SettingsPath -Parent) 'last-start.json')}
  $result | ConvertTo-Json -Depth 4 -Compress
  if(-not $passed){exit 1}
} catch {Write-Output '{"passed":false,"error":"Original media startup preflight failed; no servers stopped or profiles replaced"}';exit 1}
