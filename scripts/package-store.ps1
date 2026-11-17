param(
    [ValidatePattern('^[a-p]{32}$')][Parameter(Mandatory)][string]$EdgeId,
    [ValidatePattern('^[a-p]{32}$')][string]$ChromeId,
    [switch]$AllowTestConfiguration
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$packageVersion = $version
if ($AllowTestConfiguration) { $packageVersion += '-test' }
$out = Join-Path $root 'release-out'
$payload = Join-Path $out ('Anioto-Companion-' + $version + '-' + [guid]::NewGuid().ToString('N'))
$runtime = Join-Path $root 'local-data/runtime'
$songrec = Join-Path $root 'local-data/songrec'
foreach ($file in @((Join-Path $runtime 'python.exe'), (Join-Path $songrec 'songrec.exe'))) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'Run setup-helper.ps1 and setup-songrec.ps1 in the release checkout first.' }
}
$expectedPackages = Get-Content -LiteralPath (Join-Path $root 'helper/requirements-store.lock.txt')
$actualPackages = @(& (Join-Path $runtime 'python.exe') -m pip freeze --disable-pip-version-check)
if ($LASTEXITCODE -ne 0 -or (Compare-Object $expectedPackages $actualPackages)) { throw 'The runtime differs from requirements-store.lock.txt. Run setup-helper.ps1 -Store in a clean release checkout.' }
$browsers = @('edge')
if ($ChromeId) { $browsers += 'chrome' }
$ids = @{ edge = $EdgeId; chrome = $ChromeId }
foreach ($browser in $browsers) {
    $bundle = Join-Path $root "dist-store-$browser"
    $manifest = Get-Content -LiteralPath (Join-Path $bundle 'manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.version -ne $version -or 'nativeMessaging' -notin $manifest.permissions) { throw "Rebuild the $browser store bundle for version $version." }
    if (-not $AllowTestConfiguration -and ($manifest.host_permissions -match '\.example/')) { throw 'Test endpoints cannot be packaged for release. Build with production URLs or pass -AllowTestConfiguration for local packaging tests.' }
    $unexpected = @(Get-ChildItem -LiteralPath $bundle -Recurse -File | Where-Object { $_.Extension -notin @('.js', '.json', '.html', '.css', '.jpg', '.png', '.svg') })
    if ($unexpected.Count) { throw "Unexpected file type in the $browser store bundle. Rebuild from a clean checkout." }
}

New-Item -ItemType Directory -Path (Join-Path $payload 'local-data/native-host'), (Join-Path $payload 'helper') -Force | Out-Null
Copy-Item -LiteralPath $runtime, $songrec -Destination (Join-Path $payload 'local-data') -Recurse
foreach ($file in @('native_host.py', 'server.py', 'browser_session.py', 'requirements.txt', 'requirements-store.lock.txt', 'NativeHost.cs')) {
    Copy-Item -LiteralPath (Join-Path $root "helper/$file") -Destination (Join-Path $payload 'helper')
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'store-companion.ps1') -Destination (Join-Path $payload 'Install-Anioto.ps1')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'store-companion.cmd') -Destination (Join-Path $payload 'Install-Anioto.cmd')
Copy-Item -LiteralPath (Join-Path $root 'docs/COMPANION-NOTICES.md'), (Join-Path $root 'LICENSE') -Destination $payload
$exe = Join-Path $payload 'local-data/native-host/AniotoNativeHost.exe'
& (Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe') /nologo /target:exe ("/out:" + $exe) (Join-Path $root 'helper/NativeHost.cs')
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Could not compile the Anioto native host.' }
$config = [ordered]@{ version = $version; edge = $ids.edge; chrome = $ids.chrome }
$config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $payload 'companion.json') -Encoding ascii

function Write-Package($Directory, $File) {
    $archive = Join-Path $out $File
    $temporary = Join-Path $out ([guid]::NewGuid().ToString('N') + '.zip')
    $entries = @(Get-ChildItem -LiteralPath $Directory -Force | Select-Object -ExpandProperty Name)
    & tar.exe -a -cf $temporary -C $Directory -- @entries
    if ($LASTEXITCODE -ne 0) { throw "Could not create $File." }
    Move-Item -LiteralPath $temporary -Destination $archive -Force
    $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath ($archive + '.sha256') -Value "$hash  $File" -Encoding ascii
    Write-Output $archive
}

foreach ($browser in $browsers) {
    Write-Package (Join-Path $root "dist-store-$browser") "Anioto-$packageVersion-$browser.zip"
}
Write-Package $payload "Anioto-$packageVersion-Windows-x64.zip"
