Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path $PSScriptRoot).Path
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$pythonExe = Join-Path $repoRoot '.venv\Scripts\python.exe'
$npmCmd = 'npm.cmd'
$runDir = Join-Path $repoRoot '.run'
$pidFile = Join-Path $runDir 'voca.pids.json'

if (-not (Test-Path $pythonExe)) {
    throw "Python executable not found at $pythonExe. Create the venv first."
}

if (-not (Get-Command $npmCmd -ErrorAction SilentlyContinue)) {
    throw 'npm.cmd is not available in PATH. Install Node.js/npm first.'
}

if (-not (Test-Path (Join-Path $frontendDir 'package.json'))) {
    throw "Frontend package.json not found at $frontendDir"
}

if (-not (Test-Path $runDir)) {
    New-Item -ItemType Directory -Path $runDir | Out-Null
}

# Ensure stale processes from older runs do not collide on ports.
$stopScript = Join-Path $repoRoot 'stop-voca.ps1'
if (Test-Path $stopScript) {
    & $stopScript -Quiet
}

function Start-VocaProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDir,
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $stdout = Join-Path $runDir ("$Name.stdout.log")
    $stderr = Join-Path $runDir ("$Name.stderr.log")

    $proc = Start-Process -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDir `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru

    [PSCustomObject]@{
        name = $Name
        pid = $proc.Id
        stdout = $stdout
        stderr = $stderr
    }
}

$started = @()
$started += Start-VocaProcess -Name 'api' -WorkingDir $backendDir -FilePath $pythonExe -Arguments @('-m', 'uvicorn', 'main:app', '--reload', '--host', '127.0.0.1', '--port', '8000')
$started += Start-VocaProcess -Name 'worker' -WorkingDir $backendDir -FilePath $pythonExe -Arguments @('-m', 'services.livekit_agent', '--dev')
$started += Start-VocaProcess -Name 'frontend' -WorkingDir $frontendDir -FilePath $npmCmd -Arguments @('run', 'dev')

$started | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

foreach ($entry in $started) {
    Write-Host "Started $($entry.name) (PID=$($entry.pid))"
}

Write-Host ''
Write-Host 'Voca stack launch complete.'
Write-Host "Logs: $runDir"
Write-Host 'App: http://localhost:3000/app'
Write-Host 'Dashboard: http://localhost:3000/dashboard'
Write-Host 'API health: http://127.0.0.1:8000/health'
