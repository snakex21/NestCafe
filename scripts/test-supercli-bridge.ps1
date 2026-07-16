param(
    [string]$Engine = (Join-Path $PSScriptRoot '..\..\SuperCli\supercli-web.exe'),
    [switch]$UseBundledUI
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ui = Join-Path $project 'native-ui'
$enginePath = (Resolve-Path $Engine).Path
$tempRoot = [System.IO.Path]::GetFullPath($env:TEMP)
$testHome = Join-Path $tempRoot ("nestcafe-bridge-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testHome | Out-Null

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
    '--workspace', $project
)
if (-not $UseBundledUI) {
    $arguments += @('--ui-dir', $ui)
}

$process = Start-Process `
    -FilePath $enginePath `
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

    $root = Invoke-WebRequest -UseBasicParsing "$baseUrl/"
    if (
        $root.StatusCode -ne 200 -or
        $root.Content -notmatch '<title>NestCafe</title>' -or
        $root.Content -notmatch 'id="plan-dialog"'
    ) {
        throw 'NestCafe UI was not served'
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

    $goal = Invoke-WebRequest -UseBasicParsing "$baseUrl/api/goal"
    $memory = Invoke-WebRequest -UseBasicParsing "$baseUrl/api/memory?limit=5"
    $tasks = Invoke-WebRequest -UseBasicParsing "$baseUrl/api/tasks"
    if ($goal.StatusCode -ne 200 -or $memory.StatusCode -ne 200 -or $tasks.StatusCode -ne 200) {
        throw 'Work plan API contract is incomplete'
    }

    $goalBody = @{
        action = 'set'
        title = 'NestCafe bridge goal'
        success_criteria = 'contract passes'
    } | ConvertTo-Json -Compress
    $createdGoal = Invoke-RestMethod `
        -Method Post `
        -Uri "$baseUrl/api/goal" `
        -ContentType 'application/json' `
        -Body $goalBody
    if ($createdGoal.title -ne 'NestCafe bridge goal') {
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

    Write-Host "PASS NestCafe -> SuperCli bridge ($baseUrl)" -ForegroundColor Green
} finally {
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
        $process.WaitForExit()
    }
    $resolvedTestHome = [System.IO.Path]::GetFullPath($testHome)
    $tempPrefix = $tempRoot.TrimEnd('\') + '\'
    if ($resolvedTestHome.StartsWith($tempPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedTestHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}
