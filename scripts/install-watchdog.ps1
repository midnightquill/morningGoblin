param(
  [ValidateRange(1, 60)]
  [int]$EveryMinutes = 5,
  [ValidateRange(1, 23)]
  [int]$EveryHours,
  [string]$TaskName = "Morning Goblin Watchdog"
)
$ErrorActionPreference = "Stop"
$launcherPath = Join-Path $PSScriptRoot "watchdog-hidden.vbs"
$scriptHostPath = "$env:SystemRoot\System32\wscript.exe"
if (-not (Test-Path -LiteralPath $launcherPath) -or -not (Test-Path -LiteralPath $scriptHostPath)) {
  throw "The windowless watchdog launcher or Windows Script Host is missing."
}
# Starting powershell.exe directly can flash a console before it handles -WindowStyle.
# wscript is a GUI executable; the wrapper starts PowerShell hidden from creation.
$actionArguments = "//B //Nologo `"$launcherPath`""
$action = New-ScheduledTaskAction -Execute $scriptHostPath -Argument $actionArguments -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$interval = if ($PSBoundParameters.ContainsKey('EveryHours')) { New-TimeSpan -Hours $EveryHours } else { New-TimeSpan -Minutes $EveryMinutes }
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval $interval
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Checks Morning Goblin health invisibly every $($interval.TotalMinutes) minutes and recovers with backoff." -Force | Out-Null
Write-Output "Installed '$TaskName' with a windowless $($interval.TotalMinutes)-minute health check."
