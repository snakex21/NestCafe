param(
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$engineRoot = (Resolve-Path (Join-Path $project '..\SuperCli')).Path
$uiRoot = Join-Path $project 'native-ui'
$embedParent = Join-Path $engineRoot 'cmd\supercli-web'
$embedRoot = Join-Path $embedParent 'nestcafe-ui'
$resourceSource = Join-Path $project 'build\windows\nestcafe_windows_amd64.syso'
$engineResource = Join-Path $embedParent 'rsrc_windows_amd64.syso'
$resourceBackup = Join-Path $env:TEMP ("supercli-resource-" + [guid]::NewGuid().ToString('N') + '.syso')
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

function Refresh-WindowsIcon([string]$Path) {
    $source = @'
using System;
using System.Runtime.InteropServices;
public static class NestCafeShellRefresh {
    [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
    public static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);
}
'@
    if (-not ('NestCafeShellRefresh' -as [type])) {
        Add-Type $source
    }
    (Get-Item -LiteralPath $Path).LastWriteTime = Get-Date
    [NestCafeShellRefresh]::SHChangeNotify(0x00002000, 0x0005, $Path, [IntPtr]::Zero)
    [NestCafeShellRefresh]::SHChangeNotify(0x08000000, 0x0000, $null, [IntPtr]::Zero)
    $iconRefresh = Join-Path $env:WINDIR 'System32\ie4uinit.exe'
    if (Test-Path -LiteralPath $iconRefresh) {
        & $iconRefresh -show
    }
}

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    throw 'Nie znaleziono Go w PATH.'
}
if (-not (Test-Path -LiteralPath (Join-Path $uiRoot 'index.html'))) {
    throw "Nie znaleziono interfejsu NestCafe: $uiRoot"
}
if (-not (Test-Path -LiteralPath $resourceSource)) {
    throw "Nie znaleziono zasobu ikony NestCafe: $resourceSource"
}
if (-not (Test-Path -LiteralPath $engineResource)) {
    throw "Nie znaleziono zasobu Windows SuperCli: $engineResource"
}

Remove-TemporaryUI
New-Item -ItemType Directory -Path $embedRoot | Out-Null
Copy-Item -LiteralPath $engineResource -Destination $resourceBackup

try {
    Get-ChildItem -LiteralPath $uiRoot -File | Copy-Item -Destination $embedRoot
    Copy-Item -LiteralPath $resourceSource -Destination $engineResource -Force

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
    if (Test-Path -LiteralPath $resourceBackup) {
        Copy-Item -LiteralPath $resourceBackup -Destination $engineResource -Force
        Remove-Item -LiteralPath $resourceBackup -Force
    }
    Remove-TemporaryUI
}

if (-not (Test-Path -LiteralPath $output)) {
    throw "Nie utworzono pliku: $output"
}
Refresh-WindowsIcon $output

if (-not $SkipTests) {
    & (Join-Path $PSScriptRoot 'test-supercli-bridge.ps1') -Engine $output -UseBundledUI
    if ($LASTEXITCODE -ne 0) {
        throw 'Bundled NestCafe.exe test failed.'
    }
}

$sizeMB = [math]::Round((Get-Item -LiteralPath $output).Length / 1MB, 1)
Write-Host "GOTOWE: $output ($sizeMB MB)" -ForegroundColor Green
