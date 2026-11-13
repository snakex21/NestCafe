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
        'selectExportFormat', 'Zapisz jako', 'renderPDFPageForOCR', 'currentPDF',
        'importDocument', 'cleanupRemovedHistorySources'
    )) {
        if ($js.Contains($token)) { Pass "ocr code $token" } else { Fail "ocr code missing $token" }
    }

    $ocrCss = Join-Path $Project 'modules\ocr-viewer\native.css'
    $css = Get-Content -LiteralPath $ocrCss -Raw -Encoding UTF8
    foreach ($token in @('height: auto;', 'min-height: 920px;', '.ocr-markdown-preview.ocr-word-page h4')) {
        if ($css.Contains($token)) { Pass "ocr word preview $token" } else { Fail "ocr word preview missing $token" }
    }

    $dialogJs = Join-Path $Project 'native-ui\js\core\dialogs.js'
    $dialogSource = Get-Content -LiteralPath $dialogJs -Raw -Encoding UTF8
    foreach ($token in @('confirmDialog', 'promptDialog', 'NestCafe', 'confirm-save')) {
        if ($dialogSource.Contains($token)) { Pass "native dialog $token" } else { Fail "native dialog missing $token" }
    }

    $chatExecutionJs = Join-Path $Project 'native-ui\js\chat\execution.js'
    $chatExecutionSource = Get-Content -LiteralPath $chatExecutionJs -Raw -Encoding UTF8
    foreach ($token in @('preferredThinkingOpen', 'saved == null ? true', 'thinking-block', 'function appendReasoning', '_reasoningOpen')) {
        if ($chatExecutionSource.Contains($token)) { Pass "thinking UI $token" } else { Fail "thinking UI missing $token" }
    }

    $coreAppJs = Join-Path $Project 'native-ui\js\core\app.js'
    $coreAppSource = Get-Content -LiteralPath $coreAppJs -Raw -Encoding UTF8
    foreach ($token in @('event.type === "reasoning"', 'chat().appendReasoning')) {
        if ($coreAppSource.Contains($token)) { Pass "reasoning stream $token" } else { Fail "reasoning stream missing $token" }
    }

    $reasoningJs = Join-Path $Project 'native-ui\js\models\reasoning.js'
    $reasoningSource = Get-Content -LiteralPath $reasoningJs -Raw -Encoding UTF8
    foreach ($token in @('/api/reasoning', 'reasoning-option', 'nestcafe:model-changed')) {
        if ($reasoningSource.Contains($token)) { Pass "reasoning control $token" } else { Fail "reasoning control missing $token" }
    }

    $modelsJs = Join-Path $Project 'native-ui\js\models\models.js'
    $modelsSource = Get-Content -LiteralPath $modelsJs -Raw -Encoding UTF8
    foreach ($token in @('compactModelName', 'model-button-label', 'setModelButton')) {
        if ($modelsSource.Contains($token)) { Pass "compact model picker $token" } else { Fail "compact model picker missing $token" }
    }

    $composerCss = Join-Path $Project 'native-ui\css\components\composer-refresh.css'
    $composerSource = Get-Content -LiteralPath $composerCss -Raw -Encoding UTF8
    foreach ($token in @('Segoe Fluent Icons', '.composer-footer', '.reasoning-button', '@media (max-width: 640px)')) {
        if ($composerSource.Contains($token)) { Pass "composer refresh $token" } else { Fail "composer refresh missing $token" }
    }

    $integrationJs = Join-Path $Project 'native-ui\js\settings\settings-integrations.js'
    $integrationSource = Get-Content -LiteralPath $integrationJs -Raw -Encoding UTF8
    foreach ($token in @('Thunderbird AI Bridge', '/api/integrations/thunderbird', '127.0.0.1:47831')) {
        if ($integrationSource.Contains($token)) { Pass "thunderbird UI $token" } else { Fail "thunderbird UI missing $token" }
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

    try {
        $tb = Invoke-RestMethod "$base/api/integrations/thunderbird" -TimeoutSec 8
        if ($tb.ok -and $tb.repo_url -match 'Thunderbird-AI-Bridge' -and $tb.bundled_available) {
            Pass "thunderbird integration connected=$($tb.connected) bundled=true"
        } else {
            Fail "thunderbird integration $($tb | ConvertTo-Json -Compress)"
        }
        $tbXpi = Invoke-WebRequest -UseBasicParsing "$base/api/integrations/thunderbird/xpi" -TimeoutSec 8
        if ($tbXpi.StatusCode -eq 200 -and $tbXpi.RawContentLength -gt 1000 -and $tbXpi.Headers['Content-Disposition'] -match 'Thunderbird-AI-Bridge.xpi') {
            Pass "thunderbird bundled xpi $($tbXpi.RawContentLength) bytes"
        } else {
            Fail 'thunderbird bundled xpi'
        }
    } catch {
        Fail "thunderbird integration $($_.Exception.Message)"
    }

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
