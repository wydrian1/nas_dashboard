$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
foreach($folder in @('.runtime\backup-secrets','.runtime\automatic-backups')){
  $path=Join-Path $root $folder
  New-Item -ItemType Directory -Path $path -Force | Out-Null
  & icacls.exe $path /inheritance:r /grant:r "*${me}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Backup credentials/output permissions could not be protected.'}
}
$version='v1.75.1'
$archive="rclone-$version-windows-amd64.zip"
$tools=Join-Path $root '.runtime\rclone'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
if(-not (Test-Path (Join-Path $tools 'rclone.exe'))){
  $download=Join-Path $tools $archive
  Invoke-WebRequest "https://downloads.rclone.org/$version/$archive" -UseBasicParsing -OutFile $download
  $checksums=(Invoke-WebRequest "https://downloads.rclone.org/$version/SHA256SUMS" -UseBasicParsing).Content
  if($checksums -is [byte[]]){$checksums=[Text.Encoding]::UTF8.GetString($checksums)}
  $line=($checksums -split "`n" | Where-Object {$_ -match ([regex]::Escape($archive)+'\s*$')} | Select-Object -First 1)
  if(-not $line){throw 'Official rclone checksum entry missing.'}
  $expected=($line.Trim() -split '\s+')[0]
  if((Get-FileHash $download -Algorithm SHA256).Hash -ne $expected){throw 'rclone archive checksum does not match.'}
  Expand-Archive -LiteralPath $download -DestinationPath $tools
  Copy-Item -LiteralPath (Join-Path $tools "rclone-$version-windows-amd64\rclone.exe") -Destination (Join-Path $tools 'rclone.exe')
}
& (Join-Path $tools 'rclone.exe') version | Select-Object -First 3
$node=Get-ChildItem (Join-Path $root '.runtime') -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1
Set-Location $root
& (Join-Path $node.FullName 'node.exe') --experimental-strip-types 'scripts\Configure-Backup.ts'
if($LASTEXITCODE -ne 0){throw 'Backup configuration failed.'}
