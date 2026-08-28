param(
    [string]$Engine = '',
    [string]$Launcher = ''
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ui = Join-Path $project 'native-ui'
$usingLauncher = -not [string]::IsNullOrWhiteSpace($Launcher)
if ($usingLauncher) {
    $processPath = (Resolve-Path -LiteralPath $Launcher).Path
} else {
    if ([string]::IsNullOrWhiteSpace($Engine)) {
        $Engine = Join-Path $project 'runtime\NestCafe.exe'
    }
    $processPath = (Resolve-Path -LiteralPath $Engine).Path
}
$tempRoot = [System.IO.Path]::GetFullPath($env:TEMP)
$testRoot = Join-Path $tempRoot ("nestcafe-bridge-" + [guid]::NewGuid().ToString('N'))
$testHome = Join-Path $testRoot 'home'
$testData = Join-Path $testRoot 'data'
New-Item -ItemType Directory -Path $testHome -Force | Out-Null
New-Item -ItemType Directory -Path $testData -Force | Out-Null

$listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback,
    0
)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$baseUrl = "http://127.0.0.1:$port"

$arguments = @(
    '--no-window',
    '--echo',
    '--addr', "127.0.0.1:$port",
    '--home', $testHome,
    '--data-dir', $testData,
    '--workspace', $project
)
if (-not $usingLauncher) {
    $arguments += @('--ui-dir', $ui)
    $arguments += @('--app-name', 'NestCafe', '--app-profile', 'nestcafe', '--require-ui-contract', '1')
}

$process = Start-Process `
    -FilePath $processPath `
    -ArgumentList $arguments `
    -WorkingDirectory $project `
    -WindowStyle Hidden `
    -PassThru

try {
    $health = $null
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        try {
            $health = Invoke-RestMethod "$baseUrl/api/health"
            break
        } catch {
            Start-Sleep -Milliseconds 100
        }
    }
    if (-not $health -or -not $health.ok) {
        throw 'SuperCli bridge did not become healthy'
    }
    if ($health.home -ne $project) {
        throw "Unexpected workspace: $($health.home)"
    }

    $runtime = Invoke-RestMethod "$baseUrl/api/runtime"
    if ($runtime.app -ne 'NestCafe' -or $runtime.engine -ne 'SuperCli' -or $runtime.ui_contract -lt 1) {
        throw "Unexpected launcher contract: $($runtime | ConvertTo-Json -Compress)"
    }
    if (-not $runtime.full_filesystem_access) {
        throw 'NestCafe office profile did not enable access to ordinary user files'
    }

    $root = Invoke-WebRequest -UseBasicParsing "$baseUrl/"
    if (
        $root.StatusCode -ne 200 -or
        $root.Content -notmatch '<title>NestCafe</title>' -or
        $root.Content -notmatch '/\.__supercli/ui/runtime\.js' -or
        $root.Content -notmatch 'id="plan-dialog"' -or
        $root.Content -notmatch 'id="module-workspace"'
    ) {
        throw 'NestCafe UI was not served'
    }

    $sharedRuntime = Invoke-WebRequest -UseBasicParsing "$baseUrl/.__supercli/ui/runtime.js"
    if (
        $sharedRuntime.StatusCode -ne 200 -or
        $sharedRuntime.Content -notmatch 'SuperCliUI' -or
        $sharedRuntime.Content -notmatch 'normalizeFileChanges'
    ) {
        throw 'Shared SuperCli UI runtime is unavailable'
    }

    if ($usingLauncher) {
        $moduleCatalog = @(Invoke-RestMethod "$baseUrl/modules/catalog.json")
        $ocrModule = $moduleCatalog | Where-Object { $_.name -eq 'ocr-viewer' } | Select-Object -First 1
        if (-not $ocrModule -or $ocrModule.nativeEntry -ne 'native.js') {
            throw 'OCR Viewer module is missing from the bundled catalog'
        }
        foreach ($asset in @('native.js', 'native.css', 'pdf.min.js', 'pdf.worker.min.js')) {
            $moduleAsset = Invoke-WebRequest -UseBasicParsing "$baseUrl/modules/ocr-viewer/$asset"
            if ($moduleAsset.StatusCode -ne 200 -or $moduleAsset.RawContentLength -le 0) {
                throw "OCR Viewer asset is missing: $asset"
            }
        }
    }

    $models = Invoke-RestMethod "$baseUrl/api/models"
    if ($null -eq $models.models -or $null -eq $models.active) {
        throw 'Model catalog contract is incomplete'
    }

    $providers = Invoke-RestMethod "$baseUrl/api/providers"
    $providerFields = @($providers.PSObject.Properties.Name)
    if ($providerFields -notcontains 'providers' -or $providerFields -notcontains 'templates') {
        throw 'Provider settings contract is incomplete'
    }
    if (($providers | ConvertTo-Json -Depth 8) -match '"(api_key|APIKey)"') {
        throw 'Provider list exposed an API key field'
    }

    $visionBody = @{
        imageBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('test-image'))
        mimeType = 'image/png'
        prompt = 'Read this page'
    } | ConvertTo-Json -Compress
    $vision = Invoke-RestMethod `
        -Method Post `
        -Uri "$baseUrl/api/vision/transcribe" `
        -ContentType 'application/json' `
        -Body $visionBody
    if ($vision.text -notmatch 'Read this page') {
        throw 'OCR vision bridge did not return provider output'
    }

    $goal = Invoke-WebRequest -UseBasicParsing "$baseUrl/api/goal"
    $memory = Invoke-WebRequest -UseBasicParsing "$baseUrl/api/memory?limit=5"
    $skills = Invoke-RestMethod "$baseUrl/api/skills?limit=5"
    $tasks = Invoke-WebRequest -UseBasicParsing "$baseUrl/api/tasks"
    if (
        $goal.StatusCode -ne 200 -or
        $memory.StatusCode -ne 200 -or
        $null -eq $skills.items -or
        $tasks.StatusCode -ne 200
    ) {
        throw 'Work plan API contract is incomplete'
    }

    # This goal exists only to exercise the bridge contract. Give it an
    # unmistakably temporary name and always close it below so a failed or
    # misconfigured test process can never leave an apparently real goal active.
    $bridgeGoalTitle = 'NestCafe bridge self-test (temporary)'
    $goalBody = @{
        action = 'set'
        title = $bridgeGoalTitle
        success_criteria = 'contract passes'
    } | ConvertTo-Json -Compress
    $createdGoal = Invoke-RestMethod `
        -Method Post `
        -Uri "$baseUrl/api/goal" `
        -ContentType 'application/json' `
        -Body $goalBody
    if ($createdGoal.title -ne $bridgeGoalTitle) {
        throw 'Goal creation contract failed'
    }

    $stepBody = @{ action = 'add_task'; title = 'Run bridge test' } | ConvertTo-Json -Compress
    $goalWithStep = Invoke-RestMethod `
        -Method Post `
        -Uri "$baseUrl/api/goal" `
        -ContentType 'application/json' `
        -Body $stepBody
    if ($goalWithStep.tasks.Count -ne 1) {
        throw 'Goal task contract failed'
    }

    $closeGoalBody = @{ action = 'set_status'; status = 'abandoned' } | ConvertTo-Json -Compress
    Invoke-RestMethod `
        -Method Post `
        -Uri "$baseUrl/api/goal" `
        -ContentType 'application/json' `
        -Body $closeGoalBody | Out-Null
    $remainingGoal = Invoke-RestMethod "$baseUrl/api/goal"
    if ($remainingGoal -and $remainingGoal.title -eq $bridgeGoalTitle) {
        throw 'Temporary bridge goal remained active'
    }

    $queueBody = @{ prompt = 'Queued NestCafe bridge task' } | ConvertTo-Json -Compress
    $queuedTask = Invoke-RestMethod `
        -Method Post `
        -Uri "$baseUrl/api/tasks" `
        -ContentType 'application/json' `
        -Body $queueBody
    $queueAfterAdd = @(Invoke-RestMethod "$baseUrl/api/tasks")
    if (-not $queuedTask.id -or $queueAfterAdd.Count -ne 1) {
        throw 'Persistent queue contract failed'
    }
    Invoke-RestMethod -Method Delete "$baseUrl/api/tasks?id=$($queuedTask.id)" | Out-Null

    $body = @{
        prompt = 'NestCafe bridge contract test'
        attachments = @((Join-Path $project 'README.md'))
    } | ConvertTo-Json -Compress
    $chat = Invoke-WebRequest `
        -UseBasicParsing `
        -Method Post `
        -Uri "$baseUrl/api/chat" `
        -ContentType 'application/json' `
        -Body $body

    foreach ($eventType in @('session', 'message', 'done')) {
        if ($chat.Content -notmatch "`"type`":`"$eventType`"") {
            throw "Missing SSE event: $eventType"
        }
    }

    $profileBody = @{ prompt = 'Hello, my name is Maks.' } | ConvertTo-Json -Compress
    Invoke-WebRequest `
        -UseBasicParsing `
        -Method Post `
        -Uri "$baseUrl/api/chat" `
        -ContentType 'application/json; charset=utf-8' `
        -Body ([Text.Encoding]::UTF8.GetBytes($profileBody)) | Out-Null
    $memoryAfterProfile = Invoke-WebRequest -UseBasicParsing "$baseUrl/api/memory?limit=20"
    if ($memoryAfterProfile.Content -notmatch 'Maks') {
        throw 'Personal profile fact was not persisted by the Go web runtime'
    }

    Write-Host "PASS NestCafe -> SuperCli bridge ($baseUrl)" -ForegroundColor Green
} finally {
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
        $process.WaitForExit()
    }
    if ($usingLauncher) {
        $engineStopped = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            try {
                $probe = [System.Net.Sockets.TcpClient]::new()
                $connect = $probe.BeginConnect('127.0.0.1', $port, $null, $null)
                if (-not $connect.AsyncWaitHandle.WaitOne(50)) {
                    $probe.Close()
                    $engineStopped = $true
                    break
                }
                $probe.EndConnect($connect)
                $probe.Close()
                Start-Sleep -Milliseconds 50
            } catch {
                $engineStopped = $true
                break
            }
        }
        if (-not $engineStopped) {
            throw 'SuperCli engine remained alive after the NestCafe launcher exited'
        }
    }
    $resolvedTestHome = [System.IO.Path]::GetFullPath($testRoot)
    $tempPrefix = $tempRoot.TrimEnd('\') + '\'
    if ($resolvedTestHome.StartsWith($tempPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedTestHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}
