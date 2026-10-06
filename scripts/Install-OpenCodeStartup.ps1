# Owner/UAC installation only. Windows stores the account password in Task Scheduler, not this project.
param([Parameter(Mandatory=$true)][string]$ExpectedUserSid,[Parameter(Mandatory=$true)][string]$ExpectedRunnerSha256,[Parameter(Mandatory=$true)][string]$ExpectedCliSha256,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
if($root -ne 'D:\!nas' -or $identity.User.Value -ne $ExpectedUserSid -or $identity.User.Value -eq 'S-1-5-18'){throw 'Original owner profile required'}
if(-not $CheckOnly -and -not ([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Owner administrator approval required'}
Set-Location -LiteralPath $root
$name='WydrianOriginalOpenCodeStartup'
if(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue){throw 'Startup task already exists; refusing overwrite'}
$runner=Join-Path $root 'scripts\Start-OriginalOpenCode.ps1'
$registration=Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.local\state\opencode\service.json') -Raw | ConvertFrom-Json
$process=Get-Process -Id $registration.pid -ErrorAction Stop
$cli=$process.Path
if($ExpectedRunnerSha256 -notmatch '^[a-f0-9]{64}$' -or $ExpectedCliSha256 -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash $runner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedRunnerSha256 -or (Get-FileHash $cli -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedCliSha256){throw 'Reviewed source/CLI changed'}
if($registration.url -ne 'http://127.0.0.1:49374' -or $cli -notlike ($env:USERPROFILE+'\AppData\Roaming\ai.opencode.desktop\cli\*\opencode-cli.exe')){throw 'Unexpected original OpenCode instance'}
$directory=Join-Path $root ('.runtime\opencode-autostart\releases\'+$ExpectedRunnerSha256+'-'+[Guid]::NewGuid().ToString('N'))
if(Test-Path -LiteralPath $directory){throw 'Prepared release exists; inspect before retry'}
if($CheckOnly){@{passed=$true;checkOnly=$true;bootTrigger=$true;logonType='Password';runLevel='Limited';originalUser=$true;noTaskOrServiceChanges=$true} | ConvertTo-Json -Compress;exit 0}
$credential=Get-Credential -UserName $identity.Name -Message 'Enter this Windows account PASSWORD (not Windows Hello PIN). Used only by Task Scheduler to start the existing OpenCode before sign-in. Do not send it in chat.'
if(-not $credential -or ([Security.Principal.NTAccount]::new($credential.UserName)).Translate([Security.Principal.SecurityIdentifier]).Value -ne $ExpectedUserSid){throw 'Original user credential required; nothing installed'}
New-Item -ItemType Directory -Path $directory | Out-Null
& icacls.exe $directory /inheritance:r /grant:r ($identity.Name+':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot protect startup release'}
$installedRunner=Join-Path $directory 'Start-OriginalOpenCode.ps1'
Copy-Item -LiteralPath $runner -Destination $installedRunner
if((Get-FileHash -LiteralPath $installedRunner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedRunnerSha256){throw 'Runner changed during preparation; no task installed'}
$settingsPath=Join-Path $directory 'settings.json'
@{root=$root;userSid=$ExpectedUserSid;userProfile=$env:USERPROFILE;cliPath=$cli;cliSha256=$ExpectedCliSha256} | ConvertTo-Json | Set-Content -LiteralPath $settingsPath
$settingsHash=(Get-FileHash $settingsPath -Algorithm SHA256).Hash.ToLowerInvariant()
$powershell=Join-Path $env:windir 'System32\WindowsPowerShell\v1.0\powershell.exe'
& $powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $installedRunner -SettingsPath $settingsPath -ExpectedSettingsSha256 $settingsHash -CheckOnly
if($LASTEXITCODE -ne 0){throw 'Original-service read-only preflight failed; no task installed'}
$action=New-ScheduledTaskAction -Execute $powershell -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$installedRunner+'" -SettingsPath "'+$settingsPath+'" -ExpectedSettingsSha256 '+$settingsHash) -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -AtStartup
$trigger.Delay='PT30S'
$principal=New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Password -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$task=New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Start the existing owner OpenCode shared service after boot, without Windows interactive sign-in; preserve its original profile and sessions.'
$registered=$false
$phase='register'
try {
  Register-ScheduledTask -TaskName $name -InputObject $task -User $identity.Name -Password $credential.GetNetworkCredential().Password | Out-Null
  $registered=$true
  $credential=$null
  $phase='verify-definition'
  $installed=Get-ScheduledTask -TaskName $name
  $sid=$installed.Principal.UserId
  if($sid -notmatch '^S-1-'){ $sid=([Security.Principal.NTAccount]::new($sid)).Translate([Security.Principal.SecurityIdentifier]).Value }
  if($sid -ne $ExpectedUserSid -or $installed.Principal.LogonType -ne 'Password' -or $installed.Principal.RunLevel -ne 'Limited' -or $installed.Triggers.CimClass.CimClassName -ne 'MSFT_TaskBootTrigger'){throw 'Task scope mismatch'}
  $before=(Get-ScheduledTaskInfo -TaskName $name).LastRunTime
  $phase='verify-batch-run'
  Start-ScheduledTask -TaskName $name
  $passed=$false
  for($attempt=0;$attempt -lt 60;$attempt++){
    $info=Get-ScheduledTaskInfo -TaskName $name
    if($info.LastRunTime -gt $before -and (Get-ScheduledTask -TaskName $name).State -eq 'Ready'){if($info.LastTaskResult -ne 0){throw 'Batch-context task test failed'};$passed=$true;break}
    Start-Sleep -Seconds 1
  }
  if(-not $passed -or (Get-Process -Id $registration.pid -ErrorAction Stop).Path -ne $cli){throw 'Task verification failed; original process must remain alive'}
  $startResult=Get-Content -LiteralPath (Join-Path $directory 'last-start.json') -Raw | ConvertFrom-Json
  if(-not $startResult.passed -or -not $startResult.alreadyRunning){throw 'Expected no-op on existing service'}
  Export-ScheduledTask -TaskName $name | Set-Content -LiteralPath (Join-Path $directory 'task.xml')
  @{passed=$true;task=$name;bootTrigger=$true;delaySeconds=30;logonType='Password';runLevel='Limited';originalPidUnchanged=$true;batchContextNoOpPassed=$true;realRebootNotYetTested=$true;credentialsStoredOnlyByWindows=$true;release=$directory;at=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content '.runtime/research/opencode-autostart-install-result.json'
} catch {
  # Preserve only structured codes/classification, never the exception text or credential.
  $failure=$_
  $hresult=$failure.Exception.HResult.ToString('X8')
  $windowsCode=$null
  if($failure.Exception.Message -match '0x[0-9a-fA-F]{8}'){$windowsCode=$matches[0]}
  $category='registration-or-verification'
  if($windowsCode -eq '0x8007052e' -or $hresult -eq '8007052E'){$category='windows-logon-failed'}
  elseif($windowsCode -eq '0x80070569' -or $hresult -eq '80070569'){$category='batch-logon-right-missing'}
  elseif($windowsCode -eq '0x80070005' -or $hresult -eq '80070005'){$category='windows-access-denied'}
  $credential=$null
  if($registered){Unregister-ScheduledTask -TaskName $name -Confirm:$false}
  @{passed=$false;phase=$phase;category=$category;hresult=$hresult;windowsCode=$windowsCode;taskRemoved=$registered;originalOpenCodeNotStopped=$true;noAutomaticCredentialRetry=$true;error='Owner startup task registration or verification failed; no account password logged'} | ConvertTo-Json | Set-Content '.runtime/research/opencode-autostart-install-result.json'
  throw 'OpenCode startup registration failed; inspect protected result before retry'
}
