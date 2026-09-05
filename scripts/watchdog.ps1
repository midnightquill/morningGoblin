param(
  [switch]$NoRestart,
  [switch]$ForceRestart
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDirectory = Join-Path $projectRoot "data"
$lockPath = Join-Path $dataDirectory "bot.lock"
$heartbeatPath = Join-Path $dataDirectory "heartbeat.json"
$recoveryPath = Join-Path $dataDirectory "watchdog-recovery.json"
$watchdogLogPath = Join-Path $dataDirectory "watchdog.log"
$stdoutLogPath = Join-Path $dataDirectory "bot.stdout.log"
$stderrLogPath = Join-Path $dataDirectory "bot.stderr.log"
$entryPoint = Join-Path $projectRoot "src\index.js"
New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null

function Write-WatchdogLog {
  param([string]$Message)
  if ((Test-Path -LiteralPath $watchdogLogPath) -and (Get-Item -LiteralPath $watchdogLogPath).Length -gt 2MB) {
    Move-Item -LiteralPath $watchdogLogPath -Destination "$watchdogLogPath.1" -Force
  }
  Add-Content -LiteralPath $watchdogLogPath -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

function Get-LockedBotProcess {
  if (-not (Test-Path -LiteralPath $lockPath)) { return $null }
  $rawProcessId = [string](Get-Content -LiteralPath $lockPath -Raw -ErrorAction SilentlyContinue)
  $botProcessId = 0
  if (-not [int]::TryParse($rawProcessId.Trim(), [ref]$botProcessId) -or $botProcessId -le 0) { return $null }
  $botProcess = Get-Process -Id $botProcessId -ErrorAction SilentlyContinue
  if ($null -eq $botProcess -or $botProcess.ProcessName -ne "node") { return $null }
  return $botProcess
}

function Test-BotCommand {
  param($BotProcess)
  $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($BotProcess.Id)" -ErrorAction SilentlyContinue
  $commandLine = [string]$processInfo.CommandLine
  return $commandLine.Replace('/', '\').Contains($entryPoint)
}

$runningProcess = Get-LockedBotProcess
$healthy = $false
$reason = "no live bot process"
if ($null -ne $runningProcess) {
  if (-not (Test-BotCommand $runningProcess)) {
    Write-WatchdogLog "Refusing recovery: PID belongs to an unverified Node command."
    throw "The lock PID is not a verified Morning Goblin process. No process was stopped."
  }
  try {
    $heartbeat = Get-Content -LiteralPath $heartbeatPath -Raw | ConvertFrom-Json
    $ageSeconds = ([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse($heartbeat.updatedAt)).TotalSeconds
    $schedulerAge = if ($heartbeat.lastSchedulerAt) { ([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse($heartbeat.lastSchedulerAt)).TotalSeconds } else { [double]::PositiveInfinity }
    $starting = ((Get-Date) - $runningProcess.StartTime).TotalSeconds -lt 120
    $healthy = $heartbeat.pid -eq $runningProcess.Id -and $ageSeconds -lt 180 -and ($starting -or ($heartbeat.ready -and $schedulerAge -lt 900))
    $reason = "heartbeat age $([int]$ageSeconds)s; ready=$($heartbeat.ready); scheduler age $schedulerAge seconds"
  } catch {
    $healthy = ((Get-Date) - $runningProcess.StartTime).TotalSeconds -lt 120
    $reason = "heartbeat unavailable"
  }
}
if ($healthy -and -not $ForceRestart) {
  if (Test-Path -LiteralPath $recoveryPath) { Remove-Item -LiteralPath $recoveryPath -Force }
  Write-Output "Morning Goblin is healthy (PID $($runningProcess.Id))."
  exit 0
}
if ($NoRestart) { throw "Morning Goblin needs attention: $reason. Restart skipped." }

$attempt = 0
if (-not $ForceRestart -and (Test-Path -LiteralPath $recoveryPath)) {
  try {
    $previousRecovery = Get-Content -LiteralPath $recoveryPath -Raw | ConvertFrom-Json
    if ([DateTimeOffset]::Parse($previousRecovery.nextAttemptAt) -gt [DateTimeOffset]::UtcNow) {
      Write-Output "Recovery is waiting for its retry backoff."
      exit 0
    }
    $attempt = [int]$previousRecovery.attempt
  } catch { $attempt = 0 }
}
$attempt += 1
$delayMinutes = [Math]::Min(30, [Math]::Pow(2, [Math]::Min($attempt, 5)))
@{ attempt = $attempt; nextAttemptAt = [DateTimeOffset]::UtcNow.AddMinutes($delayMinutes).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $recoveryPath -Encoding UTF8
Write-WatchdogLog "Recovering: $reason. Attempt $attempt."

try {
  if ($null -ne $runningProcess) {
    # Verify again immediately before stopping so a recycled PID cannot target another app.
    if (-not (Test-BotCommand $runningProcess)) { throw "Process identity changed; recovery stopped." }
    Stop-Process -Id $runningProcess.Id -Force
    Wait-Process -Id $runningProcess.Id -Timeout 10 -ErrorAction SilentlyContinue
  }
  foreach ($logPath in @($stdoutLogPath, $stderrLogPath)) {
    if (Test-Path -LiteralPath $logPath) { Move-Item -LiteralPath $logPath -Destination "$logPath.1" -Force }
  }
  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  Start-Process -FilePath $nodePath -ArgumentList @("`"$entryPoint`"") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLogPath -RedirectStandardError $stderrLogPath | Out-Null
  Start-Sleep -Seconds 3
  $runningProcess = Get-LockedBotProcess
  if ($null -eq $runningProcess) { throw "Bot did not remain running. Check bot.stderr.log." }
  Write-WatchdogLog "Started Morning Goblin (PID $($runningProcess.Id)); readiness will be verified on the next check."
  Write-Output "Morning Goblin started (PID $($runningProcess.Id))."
} catch {
  Write-WatchdogLog "Recovery failed: $($_.Exception.Message)"
  throw
}
