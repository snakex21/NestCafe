param(
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$engineRoot = (Resolve-Path (Join-Path $project '..\SuperCli')).Path
$uiRoot = Join-Path $project 'native-ui'
$embedParent = Join-Path $engineRoot 'cmd\supercli-web'
$embedRoot = Join-Path $embedParent 'nestcafe-ui'
$output = Join-Path $project 'NestCafe.exe'

function Remove-TemporaryUI {
    if (-not (Test-Path -LiteralPath $embedRoot)) {
        return
    }
    $resolvedParent = [System.IO.Path]::GetFullPath($embedParent).TrimEnd('\') + '\'
    $resolvedTarget = [System.IO.Path]::GetFullPath($embedRoot)
    if (-not $resolvedTarget.StartsWith($resolvedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove unexpected path: $resolvedTarget"
    }
    Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
}

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    throw 'Nie znaleziono Go w PATH.'
}
if (-not (Test-Path -LiteralPath (Join-Path $uiRoot 'index.html'))) {
    throw "Nie znaleziono interfejsu NestCafe: $uiRoot"
}

Remove-TemporaryUI
New-Item -ItemType Directory -Path $embedRoot | Out-Null

try {
    Get-ChildItem -LiteralPath $uiRoot -File | Copy-Item -Destination $embedRoot

    Push-Location $engineRoot
    try {
        if (-not $SkipTests) {
            & go test ./internal/webgui
            if ($LASTEXITCODE -ne 0) {
                throw 'SuperCli tests failed.'
            }
        }
        & go build -trimpath -tags nestcafe '-ldflags=-H=windowsgui' -o $output ./cmd/supercli-web
        if ($LASTEXITCODE -ne 0) {
            throw 'Building NestCafe.exe failed.'
        }
    } finally {
        Pop-Location
    }
} finally {
    Remove-TemporaryUI
}

if (-not (Test-Path -LiteralPath $output)) {
    throw "Nie utworzono pliku: $output"
}

if (-not $SkipTests) {
    & (Join-Path $PSScriptRoot 'test-supercli-bridge.ps1') -Engine $output -UseBundledUI
    if ($LASTEXITCODE -ne 0) {
        throw 'Bundled NestCafe.exe test failed.'
    }
}

$sizeMB = [math]::Round((Get-Item -LiteralPath $output).Length / 1MB, 1)
Write-Host "GOTOWE: $output ($sizeMB MB)" -ForegroundColor Green
