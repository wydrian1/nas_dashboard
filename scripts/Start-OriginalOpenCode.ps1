# Runs as the original Windows user, never SYSTEM or an independent OpenCode profile.
param([Parameter(Mandatory=$true)][string]$SettingsPath,[Parameter(Mandatory=$true)][string]$ExpectedSettingsSha256,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
try {
  if($ExpectedSettingsSha256 -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $SettingsPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedSettingsSha256){throw 'settings'}
  $settings=Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
  if($identity.User.Value -ne $settings.userSid -or $identity.User.Value -eq 'S-1-5-18' -or $env:USERPROFILE -ne $settings.userProfile -or $settings.root -ne 'D:\!nas'){throw 'identity'}
  foreach($name in @('XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_STATE_HOME','OPENCODE_DB','OPENCODE_CONFIG','OPENCODE_CONFIG_CONTENT','OPENCODE_CONFIG_DIR')){if([Environment]::GetEnvironmentVariable($name)){throw 'profile override'}}
  if($env:HOME -and $env:HOME -ne $settings.userProfile){throw 'home override'}
  $config=Join-Path $settings.userProfile '.config\opencode\service.json'
  $database=Join-Path $settings.userProfile '.local\share\opencode\opencode.db'
  $registration=Join-Path $settings.userProfile '.local\state\opencode\service.json'
  if(-not (Test-Path -LiteralPath $config) -or -not (Test-Path -LiteralPath $database)){throw 'existing profile required'}
  if($settings.cliPath -notlike ($settings.userProfile+'\AppData\Roaming\ai.opencode.desktop\cli\*\opencode-cli.exe') -or (Get-FileHash -LiteralPath $settings.cliPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $settings.cliSha256){throw 'reviewed CLI required'}
  Set-Location -LiteralPath $settings.root
  function Test-OriginalService {
    try {
      $record=Get-Content -LiteralPath $registration -Raw | ConvertFrom-Json
      if($record.url -ne 'http://127.0.0.1:49374' -or -not $record.password){return $false}
      $process=Get-Process -Id $record.pid -ErrorAction Stop
      if($process.Path -ne $settings.cliPath){return $false}
      $authorization='Basic '+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('opencode:'+$record.password))
      $response=Invoke-WebRequest -Uri ($record.url+'/api/info') -Headers @{Authorization=$authorization} -UseBasicParsing -TimeoutSec 5
      $info=$response.Content | ConvertFrom-Json
      return ($response.StatusCode -eq 200 -and $info.pid -eq $record.pid)
    } catch {return $false}
  }
  $alreadyRunning=Test-OriginalService
  if(-not $alreadyRunning){
    if($CheckOnly){throw 'original service not healthy'}
    # Never replace a live registration or steal a listener from another process.
    if(Test-Path -LiteralPath $registration){$old=Get-Content -LiteralPath $registration -Raw | ConvertFrom-Json;if(Get-Process -Id $old.pid -ErrorAction SilentlyContinue){throw 'existing process unhealthy; owner inspection required'}}
    if(@(Get-NetTCPConnection -LocalPort 49374 -State Listen -ErrorAction SilentlyContinue).Count){throw 'port occupied'}
    $logs=Split-Path $SettingsPath -Parent
    $start=Start-Process -FilePath $settings.cliPath -ArgumentList 'service start' -WorkingDirectory $settings.root -Wait -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $logs 'start.stdout.private.log') -RedirectStandardError (Join-Path $logs 'start.stderr.private.log')
    if($start.ExitCode -ne 0){throw 'service start failed'}
    $healthy=$false
    for($attempt=0;$attempt -lt 60;$attempt++){if(Test-OriginalService){$healthy=$true;break};Start-Sleep -Seconds 1}
    if(-not $healthy){throw 'health check failed'}
  }
  $result=@{passed=$true;alreadyRunning=$alreadyRunning;checkOnly=[bool]$CheckOnly;originalProfilePreserved=$true;loopbackOnly=$true;at=(Get-Date).ToUniversalTime().ToString('o')}
  if(-not $CheckOnly){$result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path (Split-Path $SettingsPath -Parent) 'last-start.json')}
  $result | ConvertTo-Json -Compress
} catch {
  # Do not surface API bodies, credentials, command output or profile contents.
  Write-Output '{"passed":false,"error":"Original OpenCode startup preflight or health check failed; no stop/restart/config/database replacement performed"}'
  exit 1
}
