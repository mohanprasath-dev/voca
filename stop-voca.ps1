param(
    [switch]$Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path $PSScriptRoot).Path
$runDir = Join-Path $repoRoot '.run'
$pidFile = Join-Path $runDir 'voca.pids.json'

$killed = @()

function Stop-ByPid {
    param([int]$ProcessId)
    try {
        $proc = Get-Process -Id $ProcessId -ErrorAction Stop
        Stop-Process -Id $ProcessId -Force
        return $proc
    } catch {
        return $null
    }
}

if (Test-Path $pidFile) {
    try {
        $entries = Get-Content -Path $pidFile -Raw | ConvertFrom-Json
        foreach ($entry in $entries) {
            $stopped = Stop-ByPid -ProcessId ([int]$entry.pid)
            if ($stopped) {
                $killed += $stopped
            }
        }
    } catch {
        if (-not $Quiet) {
            Write-Warning "Unable to parse pid file: $($_.Exception.Message)"
        }
    }
}

$targets = Get-CimInstance Win32_Process | Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }

    # Sweep any strays that still reference this workspace services.
    return (
        ($cmd -like "*$repoRoot*services.livekit_agent*") -or
        ($cmd -like "*$repoRoot*uvicorn*main:app*") -or
        ($cmd -like "*$repoRoot*next*dev*")
    )
}

foreach ($proc in $targets) {
    try {
        Stop-Process -Id $proc.ProcessId -Force
        $killed += $proc
    } catch {
        if (-not $Quiet) {
            Write-Warning "Failed to stop PID $($proc.ProcessId): $($_.Exception.Message)"
        }
    }
}

if (Test-Path $pidFile) {
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
}

if (-not $Quiet) {
    if ($killed.Count -eq 0) {
        Write-Host 'No running Voca API/worker/frontend processes found.'
    } else {
        Write-Host "Stopped $($killed.Count) Voca process(es)."
    }
}
