param(
    [switch]$Required
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$fixture = Join-Path $project 'test\visual-regression.html'

function Find-ChromiumBrowser {
    foreach ($name in @('msedge.exe', 'chrome.exe', 'chromium.exe', 'opera.exe')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    foreach ($candidate in @(
        "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles (x86)\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Programs\Opera\opera.exe"
    )) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    return $null
}

$browser = Find-ChromiumBrowser
if (-not $browser) {
    if ($Required) { throw 'No Chromium browser was found; visual regression check is required.' }
    Write-Host 'SKIP visual regression: no Chromium browser found.' -ForegroundColor Yellow
    exit 0
}
if (-not (Test-Path -LiteralPath $fixture)) { throw "Missing fixture: $fixture" }

$uri = [Uri]::new($fixture).AbsoluteUri
$profile = Join-Path $env:TEMP ("nestcafe-visual-" + [guid]::NewGuid().ToString('N'))
$outFile = Join-Path $env:TEMP ("nestcafe-visual-out-" + [guid]::NewGuid().ToString('N') + '.txt')
$errFile = Join-Path $env:TEMP ("nestcafe-visual-err-" + [guid]::NewGuid().ToString('N') + '.txt')
New-Item -ItemType Directory -Path $profile -Force | Out-Null
try {
    # Headless --dump-dom occasionally serialises the page before the fixture's
    # double requestAnimationFrame runs; retry a fresh run before failing.
    $text = ''
    for ($attempt = 1; $attempt -le 3 -and -not $text.Contains('data-ready="1"'); $attempt++) {
    Remove-Item -LiteralPath $outFile, $errFile -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $browser -ArgumentList @(
        '--headless', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files',
        "--user-data-dir=$profile", '--virtual-time-budget=3000', '--window-size=1440,900',
        '--dump-dom', $uri
    ) -Wait -PassThru -RedirectStandardOutput $outFile -RedirectStandardError $errFile
    if ($process.ExitCode -ne 0) {
        $browserError = if (Test-Path -LiteralPath $errFile) { Get-Content -LiteralPath $errFile -Raw } else { '' }
        throw "Headless browser failed with exit $($process.ExitCode): $browserError"
    }
    for ($i = 0; $i -lt 25; $i++) {
        if (Test-Path -LiteralPath $outFile) {
            $text = Get-Content -LiteralPath $outFile -Raw -Encoding UTF8
            if ($text.Contains('data-ready="1"')) { break }
        }
        Start-Sleep -Milliseconds 100
    }
    }
    $checks = @{
        'long Word page grows with content' = 'data-word-height="ok"'
        'Word page stays white' = 'data-word-background="ok"'
        'Word heading stays dark' = 'data-word-heading="ok"'
        'split CSS imports load' = 'data-css-split="ok"'
        'New chat label readable' = 'data-new-chat-label="ok"'
        'fixture completed' = 'data-ready="1"'
    }
    $failed = @()
    foreach ($entry in $checks.GetEnumerator()) {
        if ($text.Contains($entry.Value)) {
            Write-Host "PASS  $($entry.Key)" -ForegroundColor Green
        } else {
            Write-Host "FAIL  $($entry.Key)" -ForegroundColor Red
            $failed += $entry.Key
        }
    }
    if ($failed.Count) { throw "Visual regression failed: $($failed -join ', ')" }
    Write-Host '==== VISUAL REGRESSION CHECK PASSED ====' -ForegroundColor Green
} finally {
    Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $outFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $errFile -Force -ErrorAction SilentlyContinue
}
