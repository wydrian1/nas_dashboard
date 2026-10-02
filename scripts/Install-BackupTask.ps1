$ErrorActionPreference='Stop'
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Administrator approval is required.'}
$root=Split-Path $PSScriptRoot -Parent
$name='WydrianDailyBackup'
if(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue){throw 'Backup task already exists; refusing to overwrite it.'}
if(-not(Test-Path (Join-Path $root '.runtime\backup-secrets\recovery-key.json'))){throw 'Run Prepare-Backup.ps1 first.'}
$node=Get-ChildItem (Join-Path $root '.runtime') -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1
$script=Join-Path $root 'scripts\Run-Backup.ts'
$action=New-ScheduledTaskAction -Execute (Join-Path $node.FullName 'node.exe') -Argument ('--experimental-strip-types "'+$script+'"') -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -Daily -At '03:00'
$identity=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $identity -Settings $settings -Description 'Daily encrypted, restore-tested Wydrian NAS snapshot and verified Google Drive upload; 30-day retention.' | Out-Null
Write-Output 'Daily backup task installed: 03:00 local time, D:\!nas. It runs without an interactive Windows sign-in.'
