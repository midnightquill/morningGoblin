Option Explicit

' Use the GUI script host so PowerShell never creates a visible console.
' Wait for completion and propagate its exit code to Task Scheduler.
Dim shell, files, watchdogPath, powershellPath, command, result
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
watchdogPath = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "watchdog.ps1")
powershellPath = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")
command = Chr(34) & powershellPath & Chr(34) & " -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File " & Chr(34) & watchdogPath & Chr(34)
If WScript.Arguments.Named.Exists("check") Then command = command & " -NoRestart"

On Error Resume Next
result = shell.Run(command, 0, True)
If Err.Number <> 0 Then WScript.Quit 1
On Error GoTo 0
WScript.Quit result
