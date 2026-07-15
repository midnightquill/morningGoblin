param(
  [ValidateRange(1, 23)]
  [int]$EveryHours = 3,

  [string]$TaskName = "Morning Goblin Watchdog"
)

$ErrorActionPreference = "Stop"

$watchdogPath = Join-Path $PSScriptRoot "watchdog.ps1"
$powershellPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$actionArguments = "-NoProfile -ExecutionPolicy Bypass -File `"$watchdogPath`""

$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $actionArguments
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Hours $EveryHours)
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Checks Morning Goblin every $EveryHours hours and restarts it if necessary." `
  -Force | Out-Null

Write-Output "Installed scheduled task '$TaskName'. It will run every $EveryHours hours and after missed runs when Windows becomes available."
