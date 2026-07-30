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
shell.Run "http://localhost:8743"
