' Starts the Practice tool kit server WITHOUT a window, and says whether it started.
' To stop it: double-click "Stop tool kit server.bat". To start it with Windows: put a shortcut to this file in the
' Startup folder (Windows key + R, type shell:startup, Enter).
Option Explicit
Dim fso, sh, dir, cfg, txt, re, m, port, info, i, pc, text
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
pc = sh.ExpandEnvironmentStrings("%COMPUTERNAME%")
port = 8080
cfg = dir & "\kit-config.json"
If fso.FileExists(cfg) Then
  txt = fso.OpenTextFile(cfg, 1).ReadAll
  Set re = New RegExp
  re.Pattern = """port""\s*:\s*(\d+)"
  Set m = re.Execute(txt)
  If m.Count > 0 Then port = CLng(m(0).SubMatches(0))
End If

info = Ask("http://localhost:" & port & "/api/info")
If info <> "" Then
  sh.Popup "The tool kit server is already running." & vbCrLf & vbCrLf & "Address: http://" & pc & ":" & port & "/", 10, "Practice tool kit server", 64
  WScript.Quit
End If

sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\server\kit-server.ps1"" -Hidden", 0, False
For i = 1 To 20
  WScript.Sleep 1000
  info = Ask("http://localhost:" & port & "/api/info")
  If info <> "" Then Exit For
Next

If info = "" Then
  sh.Popup "The tool kit server did not start." & vbCrLf & vbCrLf & "See the reason in:" & vbCrLf & dir & "\server\server.log" & vbCrLf & vbCrLf & "You can also double-click ""Start tool kit server.bat"" to see the messages in a window.", 0, "Practice tool kit server", 48
ElseIf InStr(info, """lan"":false") > 0 Then
  sh.Popup "The tool kit server is running, but for THIS computer only (http://localhost:" & port & "/)." & vbCrLf & vbCrLf & "For the other computers, right-click ""Set up tool kit server (run as administrator).bat"" and choose Run as administrator (once), then stop and start the server again.", 0, "Practice tool kit server", 48
Else
  text = "The tool kit server is running (no window)." & vbCrLf & vbCrLf & "Address for all computers:  http://" & pc & ":" & port & "/" & vbCrLf & vbCrLf & "To stop it: double-click ""Stop tool kit server.bat""."
  sh.Popup text, 10, "Practice tool kit server", 64
End If

Function Ask(u)
  Dim h
  Ask = ""
  On Error Resume Next
  Set h = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  h.setTimeouts 2000, 2000, 2000, 3000
  h.Open "GET", u, False
  h.Send
  If Err.Number = 0 Then
    If h.Status = 200 Then Ask = h.responseText
  End If
  Err.Clear
  On Error GoTo 0
End Function
