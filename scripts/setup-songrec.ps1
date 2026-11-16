param([string]$StandalonePath)

$ErrorActionPreference = 'Stop'
$localData = Join-Path (Split-Path -Parent $PSScriptRoot) 'local-data'
$destination = Join-Path $localData 'songrec'
if (Test-Path -LiteralPath (Join-Path $destination 'songrec.exe') -PathType Leaf) {
    Write-Output 'SongRec is already installed.'
    return
}
if (Test-Path -LiteralPath $destination) { throw 'Remove or rename the incomplete local-data/songrec directory before reinstalling.' }

New-Item -ItemType Directory -Path $localData -Force | Out-Null
$localData = (Resolve-Path -LiteralPath $localData).Path
$staging = Join-Path $localData ('songrec-setup-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
try {
    if (-not $StandalonePath) {
        $StandalonePath = Join-Path $staging 'SongRec-0.8.2-standalone.exe'
        Invoke-WebRequest -Uri 'https://github.com/marin-m/SongRec/releases/download/0.8.2/SongRec-0.8.2-standalone.exe' -OutFile $StandalonePath
    }
    $source = (Resolve-Path -LiteralPath $StandalonePath).Path
    $expectedHash = '7356F40C66A0524C8C52916EDE3C9582A424FAC4A43E516BD81FA362D1C71A2B'
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $expectedHash) {
        throw 'The SongRec 0.8.2 standalone download failed its SHA-256 check.'
    }
    # The pinned Windows release is a self-extracting 7z archive. Extract its
    # verified payload directly to avoid launching its graphical installer.
    $archive = Join-Path $staging 'songrec.7z'
    $installer = [IO.File]::OpenRead($source)
    try {
        $installer.Position = 156745
        $output = [IO.File]::Create($archive)
        try { $installer.CopyTo($output) } finally { $output.Dispose() }
    } finally { $installer.Dispose() }
    $files = Join-Path $staging 'files'
    New-Item -ItemType Directory -Path $files | Out-Null
    & tar.exe -xf $archive -C $files
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath (Join-Path $files 'songrec.exe') -PathType Leaf)) {
        throw 'Could not extract the SongRec command-line program.'
    }
    $resolvedFiles = (Resolve-Path -LiteralPath $files).Path
    if (-not $resolvedFiles.StartsWith($localData + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'SongRec staging directory escaped local-data.'
    }
    [IO.Directory]::Move($resolvedFiles, (Join-Path $localData 'songrec'))
    Write-Output 'SongRec is ready. Select SongRec in Anioto Settings.'
} finally {
    $resolvedStaging = (Resolve-Path -LiteralPath $staging).Path
    if ($resolvedStaging.StartsWith($localData + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
