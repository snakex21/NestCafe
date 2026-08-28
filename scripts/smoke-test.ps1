# NestCafe smoke test — engine APIs + OCR embed checks (no full vision model needed).
# By default does NOT open Explorer/Notepad (those paths left ghost windows after temp cleanup).
param(
    [string]$Project = '',
    [switch]$OpenUI
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Project)) {
    $Project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

$engine = Join-Path $Project 'runtime\NestCafe.exe'
$ui = Join-Path $Project 'native-ui'
$launcher = Join-Path $Project 'NestCafe.exe'
if (-not (Test-Path -LiteralPath $engine)) { throw "Brak silnika: $engine" }
if (-not (Test-Path -LiteralPath $ui)) { throw "Brak native-ui: $ui" }

$tempRoot = Join-Path $env:TEMP ("nestcafe-smoke-" + [guid]::NewGuid().ToString('N'))
$testHome = Join-Path $tempRoot 'home'
$testData = Join-Path $tempRoot 'data'
New-Item -ItemType Directory -Path $testHome, $testData -Force | Out-Null

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$base = "http://127.0.0.1:$port"

$arguments = @(
    '--no-window', '--echo',
    '--addr', "127.0.0.1:$port",
    '--home', $testHome,
    '--data-dir', $testData,
    '--workspace', $Project,
    '--ui-dir', $ui,
    '--app-name', 'NestCafe',
    '--app-profile', 'nestcafe',
    '--require-ui-contract', '1'
)

$process = Start-Process -FilePath $engine -ArgumentList $arguments -WorkingDirectory $Project -WindowStyle Hidden -PassThru
$failed = @()
$exitCode = 1

function Pass([string]$msg) { Write-Host "PASS  $msg" -ForegroundColor Green }
function Fail([string]$msg) { Write-Host "FAIL  $msg" -ForegroundColor Red; $script:failed += $msg }

function Close-ExplorerWindowsForPath([string]$path) {
    if ([string]::IsNullOrWhiteSpace($path)) { return }
    $needle = $path.TrimEnd('\')
    try {
        $shell = New-Object -ComObject Shell.Application
        foreach ($window in @($shell.Windows())) {
            try {
                $loc = [string]$window.LocationURL
                $doc = $window.Document
                $folderPath = $null
                if ($doc -and $doc.Folder -and $doc.Folder.Self) {
                    $folderPath = [string]$doc.Folder.Self.Path
                }
                $match = ($folderPath -and $folderPath.StartsWith($needle, [StringComparison]::OrdinalIgnoreCase)) -or
                         ($loc -and $loc.ToLowerInvariant().Contains(([Uri]$needle).AbsoluteUri.ToLowerInvariant().Replace('file:///', '').Replace('/', '\')))
                # Simpler match on path fragment
                if (-not $match -and $folderPath) {
                    $match = $folderPath.IndexOf('nestcafe-smoke-', [StringComparison]::OrdinalIgnoreCase) -ge 0
                }
                if (-not $match -and $loc) {
                    $match = $loc.IndexOf('nestcafe-smoke-', [StringComparison]::OrdinalIgnoreCase) -ge 0
                }
                if ($match) {
                    $window.Quit()
                }
            } catch {
                # ignore single window failures
            }
        }
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
    } catch {
        # COM may be unavailable in some hosts
    }
}

function Stop-SmokeSideEffects {
    # Close Notepad that may have been opened by /api/path/open during older runs
    Get-Process -Name notepad -ErrorAction SilentlyContinue |
        Where-Object {
            try {
                $_.MainWindowTitle -match 'smoke|nestcafe-smoke' -or
                $_.Path -like '*\notepad.exe'
            } catch { $false }
        } |
        ForEach-Object {
            # Only close notepad if its command line/title suggests our smoke file
            try {
                if ($_.MainWindowTitle -match 'smoke\.txt|note\.md|NestCafe smoke') {
                    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }

    Close-ExplorerWindowsForPath $tempRoot

    # Stop any NestCafe engines left from bridge child tests if they linger
    Get-Process -Name NestCafe -ErrorAction SilentlyContinue |
        Where-Object { $_.Id -ne $process.Id } |
        ForEach-Object {
            # Don't kill user's normal app unless it was started in this session for bridge;
            # bridge test cleans itself. Leave alone.
        }
}

try {
    $health = $null
    for ($i = 0; $i -lt 60; $i++) {
        try { $health = Invoke-RestMethod "$base/api/health"; break } catch { Start-Sleep -Milliseconds 100 }
    }
    if ($health -and $health.ok) { Pass "health" } else { Fail "health" }

    $runtime = Invoke-RestMethod "$base/api/runtime"
    if ($runtime.app -eq 'NestCafe' -and $runtime.engine -eq 'SuperCli') {
        Pass "runtime contract=$($runtime.ui_contract)"
    } else {
        Fail "runtime $($runtime | ConvertTo-Json -Compress)"
    }

    $root = Invoke-WebRequest -UseBasicParsing "$base/"
    if ($root.Content -match '<title>NestCafe</title>') { Pass 'ui index' } else { Fail 'ui index' }

    $ocrJs = Join-Path $Project 'modules\ocr-viewer\native.js'
    $js = Get-Content -LiteralPath $ocrJs -Raw -Encoding UTF8
    foreach ($token in @(
        'ocr-open-folder', 'ocr-open-file', 'ocr-pages-limit', 'maxPdfPages',
        'saveToOutputFolder', 'openLastFile', 'clearOutputFolder', 'autoOpenFolderAfterSave',
        'ocr-word-page', 'ocr-auto-open-folder', 'markdownToPlainText', 'data-export-format',
        'selectExportFormat', 'Zapisz jako'
    )) {
        if ($js.Contains($token)) { Pass "ocr code $token" } else { Fail "ocr code missing $token" }
    }

    $versionJson = Join-Path $Project 'native-ui\version.json'
    if (Test-Path -LiteralPath $versionJson) {
        $ver = Get-Content -LiteralPath $versionJson -Raw | ConvertFrom-Json
        if ($ver.version) { Pass "version.json $($ver.version)" } else { Fail 'version.json empty' }
    } else {
        Fail 'version.json missing'
    }

    $i18nJs = Join-Path $Project 'native-ui\js\core\i18n.js'
    if ((Test-Path -LiteralPath $i18nJs) -and ((Get-Content -LiteralPath $i18nJs -Raw) -match 'ensureLanguagePreference')) {
        Pass 'i18n bootstrap'
    } else {
        Fail 'i18n missing'
    }

    $readmeCount = @(Get-ChildItem -LiteralPath (Join-Path $Project 'readme') -Filter 'README.*.md' -ErrorAction SilentlyContinue).Count
    if ($readmeCount -ge 20) { Pass "readme languages $readmeCount" } else { Fail "readme languages $readmeCount" }

    $save = Invoke-RestMethod -Uri "$base/api/document/export/save" -Method Post `
        -ContentType 'application/json; charset=utf-8' `
        -Body '{"format":"txt","filename":"smoke.txt","text":"NestCafe smoke","dir":""}'
    if ($save.ok -and $save.used_fallback -and (Test-Path -LiteralPath $save.path)) {
        Pass "export/save fallback"
    } else {
        Fail "export/save fallback $($save | ConvertTo-Json -Compress)"
    }

    $custom = Join-Path $tempRoot 'custom-out'
    New-Item -ItemType Directory -Path $custom -Force | Out-Null
    $body = @{ format = 'md'; filename = 'note.md'; text = '# smoke'; dir = $custom } | ConvertTo-Json
    $save2 = Invoke-RestMethod -Uri "$base/api/document/export/save" -Method Post `
        -ContentType 'application/json; charset=utf-8' -Body $body
    if ($save2.ok -and -not $save2.used_fallback -and (Test-Path -LiteralPath $save2.path)) {
        Pass 'export/save custom dir'
    } else {
        Fail "export/save custom $($save2 | ConvertTo-Json -Compress)"
    }

    $docx = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/document/export" -Method Post `
        -ContentType 'application/json' -Body '{"format":"docx","filename":"a.docx","text":"Doc smoke"}'
    if ($docx.StatusCode -eq 200 -and $docx.RawContentLength -gt 500) {
        Pass "export/docx $($docx.RawContentLength) bytes"
    } else {
        Fail 'export/docx'
    }

    # Validate open endpoints without leaving Explorer/Notepad on deleted TEMP paths.
    # The handlers always return JSON first; OS window open is a side effect.
    if ($OpenUI) {
        $exportDir = Split-Path $save.path -Parent
        $openDir = Invoke-RestMethod -Uri "$base/api/folder/open" -Method Post `
            -ContentType 'application/json' -Body (@{ path = $exportDir } | ConvertTo-Json)
        if ($openDir.ok) { Pass 'folder/open (UI)' } else { Fail 'folder/open (UI)' }

        $openFile = Invoke-RestMethod -Uri "$base/api/path/open" -Method Post `
            -ContentType 'application/json' -Body (@{ path = $save.path } | ConvertTo-Json)
        if ($openFile.ok) { Pass 'path/open (UI)' } else { Fail 'path/open (UI)' }
    } else {
        # Dry check: paths are valid absolute files under temp data dir (what open handlers require).
        if ((Test-Path -LiteralPath $save.path) -and (Test-Path -LiteralPath (Split-Path $save.path -Parent))) {
            Pass 'open paths exist (no Explorer/Notepad side effects)'
        } else {
            Fail 'open paths missing'
        }
    }

    Invoke-RestMethod "$base/api/models" | Out-Null
    Pass 'models'
    Invoke-RestMethod "$base/api/settings" | Out-Null
    Pass 'settings'

    if (Test-Path -LiteralPath $launcher) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'test-supercli-bridge.ps1') -Launcher $launcher
        if ($LASTEXITCODE -eq 0) { Pass 'bridge launcher' } else { Fail "bridge launcher exit $LASTEXITCODE" }
    } else {
        Fail "launcher missing $launcher"
    }

    if ($failed.Count -eq 0) {
        Write-Host ''
        Write-Host '==== ALL SMOKE CHECKS PASSED ====' -ForegroundColor Green
        $exitCode = 0
    } else {
        Write-Host ''
        Write-Host "==== FAILED $($failed.Count) CHECK(S) ====" -ForegroundColor Red
        $failed | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
        $exitCode = 1
    }
}
finally {
    try { Stop-SmokeSideEffects } catch {}

    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }

    # Give Explorer/Notepad a moment to release file handles before delete
    Start-Sleep -Milliseconds 400
    try { Stop-SmokeSideEffects } catch {}

    for ($attempt = 0; $attempt -lt 5; $attempt++) {
        try {
            if (Test-Path -LiteralPath $tempRoot) {
                Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction Stop
            }
            break
        } catch {
            Start-Sleep -Milliseconds 300
            try { Stop-SmokeSideEffects } catch {}
        }
    }

    if (Test-Path -LiteralPath $tempRoot) {
        Write-Host "WARN  nie usunieto temp (uchwyty plikow): $tempRoot" -ForegroundColor Yellow
        Write-Host "      Zamknij okno Eksploratora/Notatnika wskazujace ten folder i skasuj recznie." -ForegroundColor Yellow
    }
}

exit $exitCode
