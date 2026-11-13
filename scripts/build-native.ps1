param(
    [switch]$SkipTests,
    [switch]$BuildEngine,
    [string]$Engine,
    # SuperCli source checkout used by -BuildEngine (CI checks out the ref
    # pinned in SUPERCLI_REF; local builds default to the sibling ..\SuperCli).
    [string]$EngineRoot,
    # Copy a freshly built XPI from ..\Thunderbird-AI-Bridge\dist and re-pin its
    # SHA-256. Without it the vendored, pinned XPI is verified and used as-is.
    [switch]$RefreshBridge
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$engineRoot = if ($EngineRoot) { (Resolve-Path -LiteralPath $EngineRoot).Path } else { Join-Path $project '..\SuperCli' }
$uiRoot = Join-Path $project 'native-ui'
$modulesRoot = Join-Path $project 'modules'
$launcherRoot = Join-Path $project 'native-launcher'
$embedRoot = Join-Path $launcherRoot 'ui'
$runtimeRoot = Join-Path $project 'runtime'
$runtimeEngine = Join-Path $runtimeRoot 'NestCafe.exe'
$resourceSource = Join-Path $project 'build\windows\nestcafe_windows_amd64.syso'
$launcherResource = Join-Path $launcherRoot 'rsrc_windows_amd64.syso'
$iconSource = Join-Path $project 'build\windows\nestcafe.ico'
$output = Join-Path $project 'NestCafe.exe'
$builtinSkillsSource = Join-Path $engineRoot 'supercli-data\skills\builtin-skills.zip'
$builtinSkillsTarget = Join-Path $project 'supercli-data\skills\builtin-skills.zip'
$bridgeRoot = Join-Path $project '..\Thunderbird-AI-Bridge'
$integrationsRoot = Join-Path $project 'integrations'
$bridgeXpiTarget = Join-Path $integrationsRoot 'Thunderbird-AI-Bridge.xpi'
$bridgeXpiPin = Join-Path $integrationsRoot 'Thunderbird-AI-Bridge.xpi.sha256'
$version = (Get-Content -LiteralPath (Join-Path $project 'VERSION') -Raw).Trim()
$uiVersionJson = Join-Path $uiRoot 'version.json'
$placeholder = 'This directory is populated temporarily by scripts/build-native.ps1.'

function Reset-EmbeddedUI {
    if (Test-Path -LiteralPath $embedRoot) {
        $resolvedParent = [System.IO.Path]::GetFullPath($launcherRoot).TrimEnd('\') + '\'
        $resolvedTarget = [System.IO.Path]::GetFullPath($embedRoot)
        if (-not $resolvedTarget.StartsWith($resolvedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove unexpected path: $resolvedTarget"
        }
        Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
    }
    New-Item -ItemType Directory -Path $embedRoot -Force | Out-Null
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $embedRoot 'placeholder.txt'), $placeholder + "`n", $utf8NoBom)
}

function Add-NestCafeModules {
    if (-not (Test-Path -LiteralPath $modulesRoot)) {
        return
    }
    $embedModules = Join-Path $embedRoot 'modules'
    New-Item -ItemType Directory -Path $embedModules -Force | Out-Null
    $catalog = @()
    Get-ChildItem -LiteralPath $modulesRoot -Directory | ForEach-Object {
        $manifestPath = Join-Path $_.FullName 'manifest.json'
        if (-not (Test-Path -LiteralPath $manifestPath)) {
            return
        }
        try {
            $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        } catch {
            Write-Warning "Pomijam modul $($_.Name): nieprawidlowy manifest.json"
            return
        }
        if (-not $manifest.name -or -not $manifest.nativeEntry) {
            return
        }
        $nativeEntry = Join-Path $_.FullName ([string]$manifest.nativeEntry)
        if (-not (Test-Path -LiteralPath $nativeEntry)) {
            Write-Warning "Pomijam modul $($_.Name): brak $($manifest.nativeEntry)"
            return
        }
        Copy-Item -LiteralPath $_.FullName -Destination $embedModules -Recurse -Force
        $catalog += $manifest
    }
    $catalogJson = ConvertTo-Json -InputObject @($catalog) -Depth 12
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $embedModules 'catalog.json'), $catalogJson, $utf8NoBom)
}

function Sync-BuiltinSkills {
    if (-not (Test-Path -LiteralPath $builtinSkillsSource)) {
        Write-Warning "Brak pakietu umiejetnosci: $builtinSkillsSource"
        return
    }
    $targetDirectory = Split-Path -Parent $builtinSkillsTarget
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
    $copy = -not (Test-Path -LiteralPath $builtinSkillsTarget)
    if (-not $copy) {
        $sourceInfo = Get-Item -LiteralPath $builtinSkillsSource
        $targetInfo = Get-Item -LiteralPath $builtinSkillsTarget
        $copy = $sourceInfo.Length -ne $targetInfo.Length -or $sourceInfo.LastWriteTimeUtc -gt $targetInfo.LastWriteTimeUtc
    }
    if ($copy) {
        Copy-Item -LiteralPath $builtinSkillsSource -Destination $builtinSkillsTarget -Force
    }
}

function Sync-ThunderbirdBridge {
    if ($RefreshBridge) {
        $builtXpi = Join-Path $bridgeRoot 'dist	hunderbird-ai-bridge.xpi'
        if (-not (Test-Path -LiteralPath $builtXpi)) {
            throw "Brak zbudowanego Thunderbird AI Bridge: $builtXpi"
        }
        New-Item -ItemType Directory -Path $integrationsRoot -Force | Out-Null
        Copy-Item -LiteralPath $builtXpi -Destination $bridgeXpiTarget -Force
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $bridgeXpiTarget).Hash.ToLowerInvariant()
        [System.IO.File]::WriteAllText($bridgeXpiPin, "$hash  Thunderbird-AI-Bridge.xpi`n", (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Thunderbird AI Bridge odswiezony, nowy SHA-256: $hash" -ForegroundColor Yellow
    }
    if (-not (Test-Path -LiteralPath $bridgeXpiTarget)) {
        Write-Warning 'Brak wbudowanego Thunderbird AI Bridge XPI. NestCafe nadal zadziala, ale uzytkownik bedzie musial pobrac rozszerzenie osobno.'
        return
    }
    if (Test-Path -LiteralPath $bridgeXpiPin) {
        $expected = ((Get-Content -LiteralPath $bridgeXpiPin -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $bridgeXpiTarget).Hash.ToLowerInvariant()
        if ($expected -ne $actual) {
            throw "Thunderbird-AI-Bridge.xpi ma inny SHA-256 niz przypiety ($actual != $expected)."
        }
    }
}

function Refresh-WindowsIcon([string]$Path) {
    $source = [string]::Join("`n", @(
        'using System;',
        'using System.Runtime.InteropServices;',
        'public static class NestCafeShellRefresh {',
        '    [DllImport("shell32.dll", CharSet=CharSet.Unicode)]',
        '    public static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);',
        '}'
    ))
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
foreach ($required in @(
    (Join-Path $uiRoot 'index.html'),
    (Join-Path $launcherRoot 'go.mod'),
    $resourceSource,
    $iconSource
)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Nie znaleziono wymaganego pliku: $required"
    }
}
if ($BuildEngine -and $Engine) {
    throw 'Uzyj albo -BuildEngine, albo -Engine, nie obu jednoczesnie.'
}

Sync-BuiltinSkills
Sync-ThunderbirdBridge

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
if ($BuildEngine) {
    if (-not (Test-Path -LiteralPath (Join-Path $engineRoot 'go.mod'))) {
        throw "Nie znaleziono zrodel SuperCli: $engineRoot"
    }
    Push-Location $engineRoot
    try {
        if (-not $SkipTests) {
            & go test ./internal/webgui ./cmd/supercli-web
            if ($LASTEXITCODE -ne 0) {
                throw 'Testy silnika SuperCli nie przeszly.'
            }
        }
        $engineVersion = $null
        if (Test-Path -LiteralPath (Join-Path $engineRoot '.git')) {
            try { $engineVersion = (& git -C $engineRoot describe --tags --always --dirty 2>$null) } catch { $engineVersion = $null }
        }
        if (-not $engineVersion) {
            $engineVersion = (Get-Content -LiteralPath (Join-Path $project 'SUPERCLI_REF') -Raw).Trim()
        }
        $engineVersion = ([string]$engineVersion).Trim().TrimStart('v')
        $engineLdflags = "-H=windowsgui -X supercli/internal/buildinfo.Version=$engineVersion"
        & go build -trimpath -buildvcs=false "-ldflags=$engineLdflags" -o $runtimeEngine ./cmd/supercli-web
        if ($LASTEXITCODE -ne 0) {
            throw 'Budowanie wymiennego silnika SuperCli nie powiodlo sie.'
        }
    } finally {
        Pop-Location
    }
} elseif ($Engine) {
    $engineSource = (Resolve-Path -LiteralPath $Engine).Path
    if ([System.IO.Path]::GetFullPath($engineSource) -ne [System.IO.Path]::GetFullPath($runtimeEngine)) {
        if (-not $SkipTests) {
            & (Join-Path $PSScriptRoot 'test-supercli-bridge.ps1') -Engine $engineSource
        }
        Copy-Item -LiteralPath $engineSource -Destination $runtimeEngine -Force
    }
} elseif (-not (Test-Path -LiteralPath $runtimeEngine)) {
    $candidate = Join-Path $engineRoot 'supercli-web.exe'
    if (-not (Test-Path -LiteralPath $candidate)) {
        throw "Brakuje $runtimeEngine. Podaj -Engine PATH albo uzyj -BuildEngine."
    }
    Copy-Item -LiteralPath $candidate -Destination $runtimeEngine -Force
}

# Keep UI version.json in sync with VERSION (shown in About + settings).
$utf8NoBomVersion = New-Object System.Text.UTF8Encoding $false
$versionJsonBody = (@{
    name    = 'NestCafe'
    version = $version
    product = 'NestCafe'
} | ConvertTo-Json -Compress)
[System.IO.File]::WriteAllText($uiVersionJson, $versionJsonBody + "`n", $utf8NoBomVersion)

Reset-EmbeddedUI
try {
    Copy-Item -Path (Join-Path $uiRoot '*') -Destination $embedRoot -Recurse -Force
    Copy-Item -LiteralPath $iconSource -Destination (Join-Path $embedRoot 'window.ico') -Force
    Add-NestCafeModules
    Copy-Item -LiteralPath $resourceSource -Destination $launcherResource -Force

    Push-Location $launcherRoot
    try {
        if (-not $SkipTests) {
            & go test ./...
            if ($LASTEXITCODE -ne 0) {
                throw 'Testy launchera NestCafe nie przeszly.'
            }
        }
        $ldflags = "-H=windowsgui -X main.version=$version"
        & go build -trimpath "-ldflags=$ldflags" -o $output .
        if ($LASTEXITCODE -ne 0) {
            throw 'Budowanie launchera NestCafe nie powiodlo sie.'
        }
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item -LiteralPath $launcherResource -Force -ErrorAction SilentlyContinue
    Reset-EmbeddedUI
}

if (-not (Test-Path -LiteralPath $output)) {
    throw "Nie utworzono pliku: $output"
}
& (Join-Path $PSScriptRoot 'brand-windows-exe.ps1') -Source $output -Target $runtimeEngine
Refresh-WindowsIcon $output
Refresh-WindowsIcon $runtimeEngine

if (-not $SkipTests) {
    & (Join-Path $PSScriptRoot 'test-supercli-bridge.ps1') -Launcher $output
}

$launcherMB = [math]::Round((Get-Item -LiteralPath $output).Length / 1MB, 1)
$engineMB = [math]::Round((Get-Item -LiteralPath $runtimeEngine).Length / 1MB, 1)
Write-Host "GOTOWE: $output ($launcherMB MB)" -ForegroundColor Green
Write-Host "SILNIK: $runtimeEngine ($engineMB MB)" -ForegroundColor Green
