' BatchPilot-Silent.vbs
' Fully silent launcher: no console window at all, just opens the app in your
' browser. Use this instead of BatchPilot.bat if you'd rather not see a
' console window - the tradeoff is you'll need Stop-BatchPilot.bat to stop
' the server later, since there's no window to close.
'
' Note: some corporate/managed PCs disable VBScript (WSH) entirely via group
' policy. If double-clicking this does nothing, use BatchPilot.bat instead.

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
jarPath = scriptDir & "\BatchPilot.jar"
pidFile = scriptDir & "\batchpilot.pid"

If Not fso.FileExists(jarPath) Then
  MsgBox "BatchPilot.jar was not found next to this script.", vbCritical, "BatchPilot"
  WScript.Quit 1
End If

On Error Resume Next
Set proc = shell.Exec("javaw -jar """ & jarPath & """")
If Err.Number <> 0 Then
  MsgBox "Couldn't start Java. Make sure Java 17+ is installed " & _
         "(https://adoptium.net), then try again.", vbCritical, "BatchPilot"
  WScript.Quit 1
End If
On Error Goto 0

Set pidStream = fso.CreateTextFile(pidFile, True)
pidStream.WriteLine proc.ProcessID
pidStream.Close

WScript.Sleep 6000

' The server auto-picks a different port if 8743 is already taken by
' something else on this machine and writes the one it actually used to
' port.txt - read that if present so the right URL opens either way.
appPort = "8743"
portFile = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.batchpilot\port.txt"
If fso.FileExists(portFile) Then
  Set portStream = fso.OpenTextFile(portFile, 1)
  readPort = Trim(portStream.ReadLine())
  portStream.Close
  If readPort <> "" Then appPort = readPort
End If

shell.Run "http://localhost:" & appPort
