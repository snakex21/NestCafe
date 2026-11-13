param(
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$distRoot = Join-Path $project 'dist'
$version = (Get-Content -LiteralPath (Join-Path $project 'VERSION') -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($version)) {
    throw 'Plik VERSION jest pusty.'
}

$packageName = "NestCafe-portable-$version"
$packageRoot = Join-Path $distRoot $packageName
$zipPath = Join-Path $distRoot ($packageName + '.zip')
$buildScript = Join-Path $PSScriptRoot 'build-native.ps1'
$bridgeTest = Join-Path $PSScriptRoot 'test-supercli-bridge.ps1'

function Assert-ChildPath([string]$Parent, [string]$Child) {
    $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    $childFull = [System.IO.Path]::GetFullPath($Child)
    if (-not $childFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Niebezpieczna sciezka pakietu: $childFull"
    }
}

function Copy-RequiredFile([string]$Source, [string]$Destination) {
    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
        throw "Brakuje wymaganego pliku: $Source"
    }
    $destinationDirectory = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

Write-Host 'Buduje aktualny silnik SuperCli i launcher NestCafe...' -ForegroundColor Cyan
if ($SkipTests) {
    & $buildScript -BuildEngine -SkipTests
} else {
    & $buildScript -BuildEngine
}
if ($LASTEXITCODE -ne 0) {
    throw 'Budowanie NestCafe nie powiodlo sie.'
}

New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
Assert-ChildPath -Parent $distRoot -Child $packageRoot
Assert-ChildPath -Parent $distRoot -Child $zipPath

if (Test-Path -LiteralPath $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
Copy-RequiredFile -Source (Join-Path $project 'NestCafe.exe') -Destination (Join-Path $packageRoot 'NestCafe.exe')
Copy-RequiredFile -Source (Join-Path $project 'runtime\NestCafe.exe') -Destination (Join-Path $packageRoot 'runtime\NestCafe.exe')
Copy-RequiredFile -Source (Join-Path $project 'LICENSE') -Destination (Join-Path $packageRoot 'LICENSE')

$skillsSource = Join-Path $project 'supercli-data\skills\builtin-skills.zip'
Copy-RequiredFile -Source $skillsSource -Destination (Join-Path $packageRoot 'supercli-data\skills\builtin-skills.zip')

$integrationSource = Join-Path $project 'integrations\Thunderbird-AI-Bridge.xpi'
if (Test-Path -LiteralPath $integrationSource -PathType Leaf) {
    Copy-RequiredFile -Source $integrationSource -Destination (Join-Path $packageRoot 'integrations\Thunderbird-AI-Bridge.xpi')
}

$nestCafeCommit = (& git -C $project rev-parse --short HEAD 2>$null)
$engineRoot = Join-Path $project '..\SuperCli'
$engineCommit = (& git -C $engineRoot rev-parse --short HEAD 2>$null)
$builtAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss UTC')
$startText = @"
NestCafe Portable $version

Uruchom NestCafe.exe. Wszystkie dane programu beda zapisywane lokalnie
w folderze supercli-data obok aplikacji, wiec caly katalog mozna przenosic.

Pakiet startuje z czystym profilem i nie zawiera kluczy API, sesji,
historii, logow ani danych przegladarki z komputera, na ktorym go zbudowano.

Build: $builtAt
NestCafe commit: $nestCafeCommit
SuperCli commit: $engineCommit
"@
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $packageRoot 'START-HERE.txt'), $startText.Trim() + "`r`n", $utf8NoBom)

if (-not $SkipTests) {
    Write-Host 'Sprawdzam gotowy pakiet portable...' -ForegroundColor Cyan
    & $bridgeTest -Launcher (Join-Path $packageRoot 'NestCafe.exe')
    if ($LASTEXITCODE -ne 0) {
        throw 'Test gotowego pakietu portable nie przeszedl.'
    }
}

$hashLines = @(
    'NestCafe.exe  ' + (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $packageRoot 'NestCafe.exe')).Hash
    'runtime\NestCafe.exe  ' + (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $packageRoot 'runtime\NestCafe.exe')).Hash
)
[System.IO.File]::WriteAllText((Join-Path $packageRoot 'SHA256SUMS.txt'), ($hashLines -join "`r`n") + "`r`n", $utf8NoBom)

Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal

$folderMB = [math]::Round(((Get-ChildItem -LiteralPath $packageRoot -File -Recurse | Measure-Object Length -Sum).Sum / 1MB), 1)
$zipMB = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 1)
Write-Host "GOTOWY FOLDER: $packageRoot ($folderMB MB)" -ForegroundColor Green
Write-Host "GOTOWY ZIP:    $zipPath ($zipMB MB)" -ForegroundColor Green
Write-Host 'Pakiet nie zawiera lokalnych danych uzytkownika.' -ForegroundColor Green
