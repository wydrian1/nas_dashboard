param(
    [Parameter(Mandatory=$true)][string]$Path,
    [string]$OutputPath = '.runtime\research\finance-workbook.json'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
# Read an already-open Excel workbook without changing it or acquiring an exclusive lock.
$file = [IO.File]::Open((Resolve-Path -LiteralPath $Path).Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
$snapshot = New-Object IO.MemoryStream
try { $file.CopyTo($snapshot) } finally { $file.Dispose() }
$snapshot.Position = 0
$sha = [Security.Cryptography.SHA256]::Create()
try { $hash = [BitConverter]::ToString($sha.ComputeHash($snapshot)).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
$snapshot.Position = 0
$zip = New-Object IO.Compression.ZipArchive($snapshot,[IO.Compression.ZipArchiveMode]::Read)
try {
    $entries = [ordered]@{}
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -match '^xl/(workbook\.xml|_rels/workbook\.xml\.rels|styles\.xml|sharedStrings\.xml|worksheets/sheet\d+\.xml)$') {
            if ($entry.Length -gt 10000000) { throw 'Workbook XML is too large.' }
            $reader = New-Object IO.StreamReader($entry.Open(),[Text.Encoding]::UTF8)
            try { $entries[$entry.FullName] = $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
    }
    $parent = Split-Path $OutputPath -Parent
    if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $json = @{sourceName=[IO.Path]::GetFileName($Path);sha256=$hash;exportedAt=[DateTime]::UtcNow.ToString('o');entries=$entries} | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath),$json,(New-Object Text.UTF8Encoding $false))
    Write-Output 'Read-only workbook snapshot exported; financial amounts were not printed.'
} finally { $zip.Dispose(); $snapshot.Dispose() }
