$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$localData = Join-Path $repoRoot 'local-data'
$runtime = Join-Path $localData 'runtime'
$cache = Join-Path $localData 'cache'
$pythonExe = Join-Path $runtime 'python.exe'
$pythonZip = Join-Path $cache 'python-3.13.17-embed-amd64.zip'
$getPip = Join-Path $cache 'get-pip.py'
$sitePackages = Join-Path $runtime 'Lib\site-packages'
$requirements = Join-Path $repoRoot 'helper\requirements.txt'

New-Item -ItemType Directory -Force -Path $localData, $cache | Out-Null

if (-not (Test-Path -LiteralPath $pythonExe)) {
    if (-not (Test-Path -LiteralPath $pythonZip)) {
        Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.13.17/python-3.13.17-embed-amd64.zip' -OutFile $pythonZip
    }
    $expected = '9e35319bffedab8b36ad44d8f377cb4f1733bcec257a0b6d04d94f01486ddb38'
    $actual = (Get-FileHash -LiteralPath $pythonZip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw 'The downloaded Python archive failed its SHA-256 check.' }
    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    Expand-Archive -LiteralPath $pythonZip -DestinationPath $runtime -Force
}

if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'The repository-local Python runtime is missing python.exe.' }
$pth = Get-ChildItem -LiteralPath $runtime -Filter 'python*._pth' | Select-Object -First 1
if (-not $pth) { throw 'The embedded Python path configuration was not found.' }
$lines = @(Get-Content -LiteralPath $pth.FullName)
if ($lines -notcontains 'Lib\site-packages') { $lines += 'Lib\site-packages' }
$lines = $lines | ForEach-Object { if ($_ -eq '#import site') { 'import site' } else { $_ } }
Set-Content -LiteralPath $pth.FullName -Value $lines -Encoding ascii
New-Item -ItemType Directory -Force -Path $sitePackages | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $sitePackages 'pip'))) {
    if (-not (Test-Path -LiteralPath $getPip)) {
        Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $getPip
    }
    & $pythonExe $getPip --no-warn-script-location
    if ($LASTEXITCODE -ne 0) { throw 'Could not bootstrap pip into the repository-local runtime.' }
}

& $pythonExe -m pip install --no-cache-dir --only-binary=:all: --target $sitePackages --requirement $requirements
if ($LASTEXITCODE -ne 0) { throw 'Could not install helper dependencies into local-data.' }
& $pythonExe -c 'import shazamio'
if ($LASTEXITCODE -ne 0) { throw 'ShazamIO could not be imported from the local runtime.' }
Write-Output 'ShazamIO helper dependencies are ready.'
