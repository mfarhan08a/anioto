param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Anioto\Companion'
$version = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'companion.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid Anioto companion version.' }
$installation = Join-Path $root $version
$hostName = 'com.anioto.companion'
$registry = @{
    edge = "Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
    chrome = "Software\Google\Chrome\NativeMessagingHosts\$hostName"
}
$manifestRelative = 'local-data\native-host\com.otone.helper.json'
$manifestPath = Join-Path $installation $manifestRelative

function Get-Registration($SubKey) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($SubKey)
    if ($null -eq $key) { return }
    try { return $key.GetValue('') } finally { $key.Dispose() }
}

if ($Uninstall) {
    if (Test-Path -LiteralPath $installation) {
        $resolvedRoot = (Resolve-Path -LiteralPath $root).Path
        $resolved = (Resolve-Path -LiteralPath $installation).Path
        foreach ($directory in @($root, $installation)) {
            if ((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to remove a redirected directory.' }
        }
        if (-not $resolved.StartsWith($resolvedRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid uninstall path.' }
        $running = @(Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($resolved + '\', [StringComparison]::OrdinalIgnoreCase) })
        if ($running.Count) { throw 'Close Edge, Chrome and any Anioto companion processes before uninstalling.' }
        for ($attempt = 0; $attempt -lt 3; $attempt++) {
            try { Remove-Item -LiteralPath $resolved -Recurse -Force; break }
            catch { if ($attempt -eq 2) { throw }; Start-Sleep -Milliseconds 500 }
        }
    }
    foreach ($subKey in $registry.Values) {
        if ((Get-Registration $subKey) -eq $manifestPath) { [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($subKey, $false) }
    }
    Write-Output "Anioto companion $version removed."
    return
}

$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'companion.json') -Raw | ConvertFrom-Json
$browsers = @('edge', 'chrome') | Where-Object { $config.$_ }
if (-not $browsers -or @($browsers | Where-Object { $config.$_ -notmatch '^[a-p]{32}$' }).Count) { throw 'Invalid store extension ID.' }
$origins = @($browsers | ForEach-Object { 'chrome-extension://{0}/' -f $config.$_ } | Select-Object -Unique)
$hostRelative = 'local-data\native-host\AniotoNativeHost.exe'
$paths = @($hostRelative, 'local-data\runtime\python.exe', 'local-data\songrec\songrec.exe', 'helper\native_host.py')
foreach ($file in $paths) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $file) -PathType Leaf)) { throw "The companion package is missing $file." }
}

New-Item -ItemType Directory -Path $root -Force | Out-Null
if ((Get-Item -LiteralPath $root).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Invalid companion directory.' }
if (-not (Test-Path -LiteralPath $installation)) {
    $staging = Join-Path $root ('.install-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging | Out-Null
    foreach ($file in @('helper', 'local-data', 'companion.json', 'Install-Anioto.ps1', 'Install-Anioto.cmd', 'COMPANION-NOTICES.md', 'LICENSE')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $staging -Recurse
    }
    Move-Item -LiteralPath $staging -Destination $installation
}
if ((Get-Item -LiteralPath $installation).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Invalid installed companion directory.' }
foreach ($file in $paths) {
    if (-not (Test-Path -LiteralPath (Join-Path $installation $file) -PathType Leaf)) { throw "Uninstall this incomplete Anioto version and retry. Missing $file." }
}
if (-not [string]::Equals([IO.Path]::GetFullPath($PSScriptRoot), [IO.Path]::GetFullPath($installation), [StringComparison]::OrdinalIgnoreCase)) {
    foreach ($file in @('companion.json', 'Install-Anioto.ps1', 'Install-Anioto.cmd')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $installation $file) -Force
    }
}
$manifest = [ordered]@{
    name = $hostName; description = 'Anioto Windows recognition companion'; type = 'stdio'
    path = Join-Path $installation $hostRelative; allowed_origins = $origins
}
$temporary = Join-Path (Split-Path -Parent $manifestPath) ([guid]::NewGuid().ToString('N') + '.json')
[IO.File]::WriteAllText($temporary, ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
if ([IO.File]::Exists($manifestPath)) {
    $backup = $temporary + '.previous'
    [IO.File]::Replace($temporary, $manifestPath, $backup)
    Remove-Item -LiteralPath $backup -Force
}
else { [IO.File]::Move($temporary, $manifestPath) }
foreach ($browser in $browsers) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($registry[$browser])
    try { $key.SetValue('', $manifestPath) } finally { $key.Dispose() }
}
Write-Output "Anioto companion $version installed. Reopen the extension to start it."
