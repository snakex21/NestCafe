param(
    [string]$Engine = (Join-Path $PSScriptRoot '..\..\SuperCli\supercli-web.exe')
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ui = Join-Path $project 'native-ui'
$enginePath = (Resolve-Path $Engine).Path

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
    '--workspace', $project,
    '--ui-dir', $ui
)

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
    if ($root.StatusCode -ne 200 -or $root.Content -notmatch '<title>NestCafe</title>') {
        throw 'NestCafe UI was not served'
    }

    $models = Invoke-RestMethod "$baseUrl/api/models"
    if ($null -eq $models.models -or $null -eq $models.active) {
        throw 'Model catalog contract is incomplete'
    }

    $body = @{ prompt = 'NestCafe bridge contract test' } | ConvertTo-Json -Compress
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
}
