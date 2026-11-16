param(
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId = 'oeamoddpghhjhhakjimcelbhjpjfboba',
    [ValidatePattern('^[a-p]{32}$')]
    [string[]]$AdditionalExtensionId = @(),
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'

function Resolve-InRepository([string]$Path, [string]$RepositoryRoot) {
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $rootPrefix = $RepositoryRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Resolved path is outside the repository: $fullPath"
    }
    return $fullPath
}

function Get-ManifestRegistration([string]$SubKey) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($SubKey, $false)
    if ($null -eq $key) { return $null }
    try { return [string]$key.GetValue('') }
    finally { $key.Dispose() }
}

function Assert-RegistrationAvailable([string]$SubKey, [string]$ManifestPath) {
    $registeredPath = Get-ManifestRegistration $SubKey
    if ($null -ne $registeredPath -and
        -not [string]::Equals($registeredPath, $ManifestPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Native messaging host '$SubKey' is already registered to another manifest: $registeredPath"
    }
}

function Register-Manifest([string]$SubKey, [string]$ManifestPath) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($SubKey)
    if ($null -eq $key) { throw "Could not create current-user registry key '$SubKey'." }
    try { $key.SetValue('', $ManifestPath, [Microsoft.Win32.RegistryValueKind]::String) }
    finally { $key.Dispose() }
}

function Remove-ManifestRegistration([string]$SubKey, [string]$ManifestPath) {
    $registeredPath = Get-ManifestRegistration $SubKey
    if ($null -eq $registeredPath) { return }
    if (-not [string]::Equals($registeredPath, $ManifestPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove '$SubKey'; it points to a different manifest: $registeredPath"
    }
    Remove-Item -LiteralPath ("Registry::HKEY_CURRENT_USER\" + $SubKey) -ErrorAction Stop
}

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourcePath = Resolve-InRepository (Join-Path $repositoryRoot 'helper\NativeHost.cs') $repositoryRoot
$nativeHostDirectory = Resolve-InRepository (Join-Path $repositoryRoot 'local-data\native-host') $repositoryRoot
$executablePath = Resolve-InRepository (Join-Path $nativeHostDirectory 'OtoneNativeHost.exe') $repositoryRoot
$manifestPath = Resolve-InRepository (Join-Path $nativeHostDirectory 'com.otone.helper.json') $repositoryRoot
$registrySubKeys = @(
    'Software\Microsoft\Edge\NativeMessagingHosts\com.otone.helper',
    'Software\Google\Chrome\NativeMessagingHosts\com.otone.helper'
)

if ($Remove) {
    foreach ($subKey in $registrySubKeys) {
        $registeredPath = Get-ManifestRegistration $subKey
        if ($null -ne $registeredPath -and -not [string]::Equals($registeredPath, $manifestPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove '$subKey'; it points to a different manifest: $registeredPath"
        }
    }
    foreach ($subKey in $registrySubKeys) { Remove-ManifestRegistration $subKey $manifestPath }
    Write-Output 'Removed matching current-user Edge and Chrome native messaging registrations. Generated local-data files were left in place.'
    exit 0
}

foreach ($subKey in $registrySubKeys) { Assert-RegistrationAvailable $subKey $manifestPath }
if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Native host source is missing: $sourcePath"
}
$compilerPath = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compilerPath -PathType Leaf)) {
    throw "The .NET Framework C# compiler was not found at '$compilerPath'. Install the Windows .NET Framework developer tools or repair the inbox compiler."
}

New-Item -ItemType Directory -Path $nativeHostDirectory -Force | Out-Null
& $compilerPath /nologo /target:exe ("/out:" + $executablePath) $sourcePath
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    throw "Could not compile OtoneNativeHost.exe with the inbox C# compiler (exit code $LASTEXITCODE). Review the compiler diagnostics above."
}

$extensionIds = @($ExtensionId) + @($AdditionalExtensionId)
$allowedOrigins = @($extensionIds | Select-Object -Unique | ForEach-Object { "chrome-extension://$_/" })
$manifest = [ordered]@{
    name = 'com.otone.helper'
    description = 'Otone local recognition helper bridge'
    path = $executablePath
    type = 'stdio'
    allowed_origins = $allowedOrigins
}
$manifestJson = $manifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($manifestPath, $manifestJson + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))

try {
    foreach ($subKey in $registrySubKeys) { Register-Manifest $subKey $manifestPath }
} catch {
    foreach ($subKey in $registrySubKeys) {
        $registeredPath = Get-ManifestRegistration $subKey
        if ($null -ne $registeredPath -and [string]::Equals($registeredPath, $manifestPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            Remove-ManifestRegistration $subKey $manifestPath
        }
    }
    throw
}
Write-Output "Otone native messaging helper is registered for Edge and Chrome for: $($extensionIds -join ', ')"
