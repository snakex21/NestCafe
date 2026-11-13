param(
    [Parameter(Mandatory = $true)]
    [string]$Engine
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = (Resolve-Path -LiteralPath $Engine).Path
$runtimeRoot = Join-Path $project 'runtime'
$destination = Join-Path $runtimeRoot 'NestCafe.exe'
$brandingSource = Join-Path $project 'NestCafe.exe'

function Refresh-WindowsIcon([string]$Path) {
    $source = @'
using System;
using System.Runtime.InteropServices;
public static class NestCafeEngineShellRefresh {
    [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
    public static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);
}
'@
    if (-not ('NestCafeEngineShellRefresh' -as [type])) {
        Add-Type $source
    }
    (Get-Item -LiteralPath $Path).LastWriteTime = Get-Date
    [NestCafeEngineShellRefresh]::SHChangeNotify(0x00002000, 0x0005, $Path, [IntPtr]::Zero)
    [NestCafeEngineShellRefresh]::SHChangeNotify(0x08000000, 0x0000, $null, [IntPtr]::Zero)
    $iconRefresh = Join-Path $env:WINDIR 'System32\ie4uinit.exe'
    if (Test-Path -LiteralPath $iconRefresh) {
        & $iconRefresh -show
    }
}

if ([System.IO.Path]::GetExtension($source) -ne '.exe') {
    throw "Silnik musi byc plikiem EXE: $source"
}
if (-not (Test-Path -LiteralPath $brandingSource)) {
    throw "Brakuje launchera NestCafe potrzebnego do nadania ikony: $brandingSource"
}

Write-Host 'Sprawdzam zgodnosc nowego silnika z NestCafe...' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'test-supercli-bridge.ps1') -Engine $source

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
if ([System.IO.Path]::GetFullPath($source) -eq [System.IO.Path]::GetFullPath($destination)) {
    Write-Host "Silnik jest juz aktualny: $destination" -ForegroundColor Green
    exit 0
}

$staged = Join-Path $runtimeRoot 'NestCafe.new.exe'
$backup = Join-Path $runtimeRoot 'NestCafe.old.exe'
Copy-Item -LiteralPath $source -Destination $staged -Force
try {
    & (Join-Path $PSScriptRoot 'brand-windows-exe.ps1') -Source $brandingSource -Target $staged
} catch {
    Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
    throw "Nie udalo sie przygotowac silnika NestCafe. $($_.Exception.Message)"
}

try {
    if (Test-Path -LiteralPath $destination) {
        [System.IO.File]::Replace($staged, $destination, $backup, $true)
        Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
    } else {
        Move-Item -LiteralPath $staged -Destination $destination
    }
} catch {
    # Windows may lock the running engine executable. Leave the already tested
    # and branded .new file in place; the launcher promotes it before starting
    # the engine on the next normal application restart. If File.Replace moved
    # the old engine before failing, restore that backup first.
    if (-not (Test-Path -LiteralPath $destination) -and (Test-Path -LiteralPath $backup)) {
        Move-Item -LiteralPath $backup -Destination $destination -Force
    }
    if (Test-Path -LiteralPath $staged) {
        Write-Host "Silnik jest uruchomiony. Aktualizacja zostala przygotowana na nastepny restart: $staged" -ForegroundColor Yellow
        exit 0
    }
    throw "Nie udalo sie podmienic silnika i nie pozostala bezpieczna aktualizacja oczekujaca. $($_.Exception.Message)"
}

Refresh-WindowsIcon $destination

Write-Host "ZAKTUALIZOWANO: $destination" -ForegroundColor Green
Write-Host 'NestCafe.exe nie wymaga przebudowania.' -ForegroundColor Green
