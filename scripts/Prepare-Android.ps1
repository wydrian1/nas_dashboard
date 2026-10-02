# Project-local toolchain only. Run only after accepting Android SDK terms.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$tools=Join-Path $root '.runtime\android-tools'
New-Item -ItemType Directory -Force -Path $tools | Out-Null
$assets=Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse'
$pkg=$assets[0].binary.package
$jdk=Join-Path $tools 'jdk.zip'
if(-not (Get-ChildItem $tools -Directory -Filter 'jdk-*')) {
  Invoke-WebRequest $pkg.link -OutFile $jdk -UseBasicParsing
  if((Get-FileHash $jdk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pkg.checksum){throw 'JDK checksum mismatch.'}
  Expand-Archive $jdk -DestinationPath $tools
}
$env:JAVA_HOME=(Get-ChildItem $tools -Directory -Filter 'jdk-*' | Select-Object -First 1).FullName
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
$sdk=Join-Path $tools 'sdk'
$manager=Join-Path $sdk 'cmdline-tools\19.0\bin\sdkmanager.bat'
if(-not(Test-Path $manager)){
  [xml]$repo=(Invoke-WebRequest 'https://dl.google.com/android/repository/repository2-1.xml' -UseBasicParsing).Content
  # Pin the SDK Manager interface; newer Android CLI no longer accepts these package IDs.
  $entry=$repo.SelectNodes("//*[local-name()='remotePackage' and @path='cmdline-tools;19.0']")
  $archive=$entry.SelectNodes(".//*[local-name()='archive']") | Where-Object {$_.SelectSingleNode("./*[local-name()='host-os']").InnerText -eq 'windows'} | Select-Object -First 1
  $complete=$archive.SelectSingleNode("./*[local-name()='complete']")
  $url=$complete.SelectSingleNode("./*[local-name()='url']").InnerText
  $checksum=$complete.SelectSingleNode("./*[local-name()='checksum']").InnerText
  $zip=Join-Path $tools 'sdk-tools-19.zip'
  Invoke-WebRequest ('https://dl.google.com/android/repository/'+$url) -OutFile $zip -UseBasicParsing
  if((Get-FileHash $zip -Algorithm SHA1).Hash.ToLowerInvariant() -ne $checksum){throw 'Android tools checksum mismatch.'}
  $unpack=Join-Path $tools 'sdk-unpack-19'
  Expand-Archive $zip -DestinationPath $unpack
  New-Item -ItemType Directory -Force -Path "$sdk\cmdline-tools" | Out-Null
  Move-Item "$unpack\cmdline-tools" "$sdk\cmdline-tools\19.0"
}
# Explicit user consent to the SDK license was obtained before running this script.
1..30 | ForEach-Object {'y'} | & $manager "--sdk_root=$sdk" --licenses | Out-File (Join-Path $tools 'licenses.log')
& $manager "--sdk_root=$sdk" 'platforms;android-35' 'build-tools;35.0.0' 'platform-tools'
if($LASTEXITCODE -ne 0){throw 'Android SDK install failed.'}
$gradle=Join-Path $tools 'gradle-8.11.1\bin\gradle.bat'
if(-not(Test-Path $gradle)){
  $zip=Join-Path $tools 'gradle.zip'
  if(-not(Test-Path $zip)){Invoke-WebRequest 'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip' -OutFile $zip -UseBasicParsing}
  $raw=(Invoke-WebRequest 'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip.sha256' -UseBasicParsing).Content
  $hash=if($raw -is [byte[]]){[Text.Encoding]::UTF8.GetString($raw).Trim()}else{([string]$raw).Trim()}
  if((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash){throw 'Gradle checksum mismatch.'}
  Expand-Archive $zip -DestinationPath $tools
}
Write-Output 'Project-local Android build tools ready.'
