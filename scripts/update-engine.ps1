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
    if (Test-Path -LiteralPath $destination) {
        [System.IO.File]::Replace($staged, $destination, $backup, $true)
        Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
    } else {
        Move-Item -LiteralPath $staged -Destination $destination
    }
} catch {
    Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
    throw "Nie udalo sie podmienic silnika. Zamknij NestCafe i sprobuj ponownie. $($_.Exception.Message)"
}

Refresh-WindowsIcon $destination

Write-Host "ZAKTUALIZOWANO: $destination" -ForegroundColor Green
Write-Host 'NestCafe.exe nie wymaga przebudowania.' -ForegroundColor Green
