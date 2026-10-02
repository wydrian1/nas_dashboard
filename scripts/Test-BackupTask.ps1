$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$name='WydrianDailyBackup'
$task=Get-ScheduledTask -TaskName $name
if($task.Actions.WorkingDirectory -ne $root -or $task.Actions.Execute -notlike "$root\*"){throw 'Task does not target the active project.'}
$started=(Get-Date).ToUniversalTime()
Start-ScheduledTask -TaskName $name
$deadline=(Get-Date).AddMinutes(15)
do{Start-Sleep -Seconds 2;$task=Get-ScheduledTask -TaskName $name}while($task.State -eq 'Running' -and (Get-Date) -lt $deadline)
$info=Get-ScheduledTaskInfo -TaskName $name
if($task.State -eq 'Running' -or $info.LastTaskResult -ne 0){throw "Scheduled backup did not complete successfully (result $($info.LastTaskResult))."}
$status=Get-Content (Join-Path $root '.runtime\automatic-backups\status.json') -Raw | ConvertFrom-Json
if(-not $status.localRestoreVerified){throw 'Scheduled backup restore verification is missing.'}
if([DateTime]::Parse($status.updatedAt).ToUniversalTime() -lt $started){throw 'Scheduled backup status is stale.'}
$config=Get-Content (Join-Path $root '.runtime\backup-secrets\settings.json') -Raw | ConvertFrom-Json
if($config.cloudEnabled -and (-not $status.cloudVerified -or $status.state -ne 'success')){throw 'Scheduled cloud backup verification is missing.'}
$report=[ordered]@{verifiedAt=(Get-Date).ToUniversalTime().ToString('o');taskName=$name;identity=$task.Principal.UserId;activeRoot=$root;lastTaskResult=$info.LastTaskResult;nextRunTime=$info.NextRunTime.ToString('o');localRestoreVerified=$status.localRestoreVerified;cloudVerified=$status.cloudVerified;state=$status.state}
$text=$report | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $root '.runtime\research\backup-task-verified.json'),$text,(New-Object Text.UTF8Encoding $false))
Write-Output $text
