param([string]$Source = 'D:\key_ssl\oauth client\txt', [string]$BaseUrl = 'http://localhost:3000')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $root '.env.local'
if (Test-Path $destination) { throw '.env.local már létezik; nem írom felül.' }
$values = @{}
foreach ($line in (Get-Content -LiteralPath $Source)) {
    if ($line -match '^\s*(clientid|clientsecret)\s*[:=]\s*(.*?)\s*$') {
        $values[$Matches[1].ToLower()] = $Matches[2].Trim().Trim('"').Trim("'")
    }
}
if (-not $values['clientid'] -or -not $values['clientsecret']) { throw 'clientid és clientsecret sorok szükségesek.' }
if ($values['clientid'] -notmatch '\.apps\.googleusercontent\.com$') { throw 'Érvénytelen kliensazonosító.' }
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$secret = [Convert]::ToBase64String($bytes)
$content = "AUTH_SECRET=$secret`nAUTH_GOOGLE_ID=$($values['clientid'])`nAUTH_GOOGLE_SECRET=$($values['clientsecret'])`nAUTH_URL=$BaseUrl`nALLOWED_EMAIL=wydrian@gmail.com`n"
[System.IO.File]::WriteAllText($destination, $content, (New-Object System.Text.UTF8Encoding $false))
# Restrict the secret file to its owner and SYSTEM; do not inherit general users' access.
$acl = New-Object System.Security.AccessControl.FileSecurity
$acl.SetAccessRuleProtection($true, $false)
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl.SetOwner($owner)
foreach ($identity in @($owner, (New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-18'))) {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $destination -AclObject $acl
Write-Output 'OAuth-adatok importálva; a titkokat nem írtam ki.'
