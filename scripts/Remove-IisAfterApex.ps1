# Optional second owner-approved step, ONLY after the apex HTTPS handover is verified.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) -or $root -ne 'D:\!nas'){throw 'Owner administrator approval required'}
$activation=Get-Content '.runtime/research/apex-https-activation-result.json' -Raw | ConvertFrom-Json
if(-not $activation.passed -or -not (Test-Path -LiteralPath (Join-Path $activation.backup 'applicationHost.config'))){throw 'Verified handover and IIS configuration backup required'}
$response=Invoke-WebRequest 'https://wydrian.hu/' -UseBasicParsing -TimeoutSec 30
if($response.StatusCode -ne 200){throw 'Apex HTTPS unhealthy; IIS retirement blocked'}
$features=@(Get-WindowsOptionalFeature -Online | Where-Object { $_.FeatureName -like 'IIS-*' -and $_.State -eq 'Enabled' })
$features | Select-Object FeatureName,State | ConvertTo-Json | Set-Content (Join-Path $activation.backup 'iis-features-before.json')
$results=@()
if($features.Count){$results=@(Disable-WindowsOptionalFeature -Online -FeatureName @($features.FeatureName) -NoRestart)}
$remaining=@(Get-WindowsOptionalFeature -Online | Where-Object { $_.FeatureName -like 'IIS-*' -and $_.State -eq 'Enabled' })
if($remaining.Count){throw 'Some IIS features remain enabled; no reboot performed'}
@{passed=$true;iisFeaturesDisabled=$features.Count;restartNeeded=(@($results | Where-Object RestartNeeded).Count -gt 0);noRebootPerformed=$true;configurationBackupPreserved=$true;nonIisFeaturesUntouched=$true} | ConvertTo-Json | Set-Content '.runtime/research/apex-iis-retirement-result.json'
