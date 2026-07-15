param(
  [switch]$NoRestart
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDirectory = Join-Path $projectRoot "data"
$lockPath = Join-Path $dataDirectory "bot.lock"
$watchdogLogPath = Join-Path $dataDirectory "watchdog.log"
$stdoutLogPath = Join-Path $dataDirectory "bot.stdout.log"
$stderrLogPath = Join-Path $dataDirectory "bot.stderr.log"
$entryPoint = Join-Path $projectRoot "src\index.js"

New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null

function Write-WatchdogLog {
  param([string]$Message)

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $watchdogLogPath -Value "[$timestamp] $Message"
}

function Get-LockedBotProcess {
  if (-not (Test-Path -LiteralPath $lockPath)) {
    return $null
  }

  $rawProcessId = (Get-Content -LiteralPath $lockPath -Raw -ErrorAction SilentlyContinue).Trim()
  $processId = 0

  if (-not [int]::TryParse($rawProcessId, [ref]$processId) -or $processId -le 0) {
    return $null
  }

  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

  if ($null -eq $process -or $process.ProcessName -ne "node") {
    return $null
  }

  return $process
}

$runningProcess = Get-LockedBotProcess

if ($null -ne $runningProcess) {
  Write-WatchdogLog "Healthy: Morning Goblin is running (PID $($runningProcess.Id))."
  Write-Output "Morning Goblin is running (PID $($runningProcess.Id))."
  exit 0
}

if ($NoRestart) {
  Write-WatchdogLog "Unhealthy: no live bot process was found. Restart skipped because -NoRestart was used."
  Write-Error "Morning Goblin is not running."
  exit 1
}

Write-WatchdogLog "Unhealthy: no live bot process was found. Starting Morning Goblin."

try {
  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  $startedProcess = Start-Process `
    -FilePath $nodePath `
    -ArgumentList @($entryPoint) `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLogPath `
    -RedirectStandardError $stderrLogPath `
    -PassThru

  Start-Sleep -Seconds 3

  $runningProcess = Get-LockedBotProcess

  if ($null -eq $runningProcess) {
    throw "The bot process did not remain running. Check $stderrLogPath for startup errors."
  }

  Write-WatchdogLog "Recovered: Morning Goblin started successfully (PID $($runningProcess.Id))."
  Write-Output "Morning Goblin was restarted (PID $($runningProcess.Id))."
  exit 0
} catch {
  Write-WatchdogLog "Recovery failed: $($_.Exception.Message)"
  Write-Error $_
  exit 1
}
