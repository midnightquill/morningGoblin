param(
  [ValidateRange(1, 60)]
  [int]$EveryMinutes = 1,
  [ValidateRange(1, 23)]
  [int]$EveryHours,
  [string]$TaskName = "Morning Goblin Watchdog"
)
$ErrorActionPreference = "Stop"
$watchdogPath = Join-Path $PSScriptRoot "watchdog.ps1"
$powershellPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$actionArguments = "-NoProfile -ExecutionPolicy Bypass -File `"$watchdogPath`""
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $actionArguments
$interval = if ($PSBoundParameters.ContainsKey('EveryHours')) { New-TimeSpan -Hours $EveryHours } else { New-TimeSpan -Minutes $EveryMinutes }
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval $interval
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Checks Morning Goblin health every $($interval.TotalMinutes) minutes and recovers with backoff." -Force | Out-Null
Write-Output "Installed '$TaskName' with a $($interval.TotalMinutes)-minute health check."
