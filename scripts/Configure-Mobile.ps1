# Protect/copy the service-account file first; only these two environment variables change.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$credential=Join-Path $root '.runtime\secrets\firebase-service-account.json'
if(-not(Test-Path $credential)){throw 'Server-only Firebase credential is missing.'}
$envFile=Join-Path $root '.env.local'
Copy-Item -LiteralPath $envFile -Destination (Join-Path $root ('.runtime\secrets\env-before-mobile-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.txt'))
$text=[IO.File]::ReadAllText($envFile)
foreach($entry in @(@('POKEMON_FCM_CREDENTIALS','.runtime/secrets/firebase-service-account.json'),@('POKEMON_PUSH_ENABLED','true'))){
  $pattern='(?m)^'+$entry[0]+'=.*$'
  $line=$entry[0]+'='+$entry[1]
  if([regex]::IsMatch($text,$pattern)){$text=[regex]::Replace($text,$pattern,$line)}else{$text=$text.TrimEnd()+"`r`n"+$line+"`r`n"}
}
[IO.File]::WriteAllText($envFile,$text,(New-Object Text.UTF8Encoding $false))
Write-Output 'Firebase push configured. A paired/consenting device is required before any push can be sent.'
