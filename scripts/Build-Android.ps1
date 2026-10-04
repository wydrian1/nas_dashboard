param([switch]$PublishDownload)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$tools=Join-Path $root '.runtime\android-tools'
$env:JAVA_HOME=(Get-ChildItem $tools -Directory -Filter 'jdk-*' | Select-Object -First 1).FullName
$env:ANDROID_HOME=Join-Path $tools 'sdk'
$env:GRADLE_USER_HOME=Join-Path $tools 'gradle-cache'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
$gradle=Join-Path $tools 'gradle-8.11.1\bin\gradle.bat'
if(-not(Test-Path $gradle)){throw 'Run Prepare-Android.ps1 first.'}
$signing=Join-Path $root '.runtime\android-signing'
New-Item -ItemType Directory -Force -Path $signing | Out-Null
$me=[Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $signing /inheritance:r /grant:r "${me}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot protect signing keys.'}
$passwordFile=Join-Path $signing 'password.txt'
if(-not(Test-Path $passwordFile)){
  $bytes=New-Object byte[] 32
  $rng=[Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($bytes);$rng.Dispose()
  [IO.File]::WriteAllText($passwordFile,[Convert]::ToBase64String($bytes))
}
$env:WYDRIAN_KEYSTORE=Join-Path $signing 'wydrian-nas.jks'
$env:WYDRIAN_KEYSTORE_PASSWORD=[IO.File]::ReadAllText($passwordFile)
if(-not(Test-Path $env:WYDRIAN_KEYSTORE)){
  & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -keystore $env:WYDRIAN_KEYSTORE -storepass:env WYDRIAN_KEYSTORE_PASSWORD -keypass:env WYDRIAN_KEYSTORE_PASSWORD -alias wydrian-nas -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Wydrian NAS, O=Private Dashboard, C=HU'
  if($LASTEXITCODE -ne 0){throw 'APK signing key creation failed.'}
}
try{
  & $gradle -p (Join-Path $root 'android') --no-daemon --console=plain testReleaseUnitTest lintRelease assembleRelease
  if($LASTEXITCODE -ne 0){throw 'Android build/test/lint failed.'}
  $destination=Join-Path $root '.runtime\artifacts'
  New-Item -ItemType Directory -Force -Path $destination | Out-Null
  $source=[IO.File]::ReadAllText((Join-Path $root 'android\app\build.gradle'))
  $version=[regex]::Match($source,"versionName '([0-9.]+)'").Groups[1].Value
  if(-not $version){throw 'APK version is missing.'}
  $apk=Join-Path $destination "Wydrian-NAS-$version.apk"
  Copy-Item (Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk') $apk
  & "$env:ANDROID_HOME\build-tools\35.0.0\apksigner.bat" verify --print-certs $apk
  if($LASTEXITCODE -ne 0){throw 'APK signature verification failed.'}
  # The already deployed protected download route uses this legacy filename.
  # Publish only after successful tests and signature verification; no server restart needed.
  if($PublishDownload -and $version -ne '1.0.0'){Copy-Item $apk (Join-Path $destination 'Wydrian-NAS-1.0.0.apk')}
  Get-FileHash $apk -Algorithm SHA256 | Select-Object Path,Hash
}finally{Remove-Item Env:\WYDRIAN_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue}
