param(
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId = 'oeamoddpghhjhhakjimcelbhjpjfboba',
    [string[]]$ExtensionOrigin = @()
)
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$pythonExe = Join-Path $repoRoot 'local-data\runtime\python.exe'
$serverScript = Join-Path $repoRoot 'helper\server.py'
if (-not (Test-Path -LiteralPath $pythonExe) -or -not (Test-Path -LiteralPath $serverScript)) {
    throw 'Run scripts/setup-helper.ps1 before starting the local recognition helper.'
}
$pythonExe = (Resolve-Path -LiteralPath $pythonExe).Path
$serverScript = (Resolve-Path -LiteralPath $serverScript).Path

$desiredOrigins = @("chrome-extension://$ExtensionId") + @($ExtensionOrigin | Where-Object { $_ })
$desiredOrigins = @($desiredOrigins | Select-Object -Unique)
foreach ($origin in $desiredOrigins) {
    if ($origin -notmatch '^(chrome-extension|edge-extension)://[a-p]{32}$' -and
        $origin -notmatch '^(moz-extension|safari-web-extension)://[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') {
        throw "Invalid extension origin '$origin'. Pass an exact supported browser extension origin without a path or port."
    }
}

try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:18742/health' -TimeoutSec 2
    if ($health.ok -and $health.provider -eq 'shazamio') {
        $runningOrigins = @($health.allowedOrigins)
        if (-not $health.PSObject.Properties['allowedOrigins']) {
            if ($desiredOrigins.Count -eq 1 -and $desiredOrigins[0] -eq 'chrome-extension://oeamoddpghhjhhakjimcelbhjpjfboba') {
                Write-Output 'Local ShazamIO helper is already running with the legacy default origin.'
                exit 0
            }
            throw "A healthy older helper is already running and does not report its allowed origins. Stop that helper manually, then rerun this script for: $($desiredOrigins -join ', ')"
        }
        $missingOrigins = @($desiredOrigins | Where-Object { $_ -notin $runningOrigins })
        if ($missingOrigins.Count -gt 0) {
            $restartOrigins = @($runningOrigins + $desiredOrigins | Select-Object -Unique) -join ', '
            throw "A healthy helper is running, but its allowlist is missing: $($missingOrigins -join ', '). Stop the helper manually, then restart it with all required origins: $restartOrigins"
        }
        Write-Output 'Local ShazamIO helper is already running with the requested extension origins.'
        exit 0
    }
} catch {
    if ($_.Exception.Message -like 'A healthy *') { throw }
}

$previousOrigins = $env:ASF_EXTENSION_ORIGINS
$previousOrigin = $env:ASF_EXTENSION_ORIGIN
try {
    $env:ASF_EXTENSION_ORIGINS = $desiredOrigins -join ','
    Remove-Item Env:ASF_EXTENSION_ORIGIN -ErrorAction SilentlyContinue
    $helperProcess = Start-Process -FilePath $pythonExe -ArgumentList @('"' + $serverScript + '"') -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
    Set-Content -LiteralPath (Join-Path $repoRoot 'local-data\helper.pid') -Value $helperProcess.Id -Encoding ascii
} finally {
    if ($null -eq $previousOrigins) { Remove-Item Env:ASF_EXTENSION_ORIGINS -ErrorAction SilentlyContinue }
    else { $env:ASF_EXTENSION_ORIGINS = $previousOrigins }
    if ($null -eq $previousOrigin) { Remove-Item Env:ASF_EXTENSION_ORIGIN -ErrorAction SilentlyContinue }
    else { $env:ASF_EXTENSION_ORIGIN = $previousOrigin }
}
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:18742/health' -TimeoutSec 2
        if ($health.ok -and $health.provider -eq 'shazamio') {
            $missingOrigins = @($desiredOrigins | Where-Object { $_ -notin @($health.allowedOrigins) })
            if ($missingOrigins.Count -eq 0) {
                Write-Output "Local ShazamIO helper is running at http://127.0.0.1:18742 for: $($desiredOrigins -join ', ')"
                exit 0
            }
            throw "A helper answered health checks but is missing requested origins: $($missingOrigins -join ', ')."
        }
    } catch {
        if ($_.Exception.Message -like 'A helper answered*') { throw }
    }
}
throw 'The local helper did not become healthy. Verify its runtime setup and port 18742 availability.'
