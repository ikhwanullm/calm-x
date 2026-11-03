' Runs the Calm-X PowerShell scripts without a console window (a shortcut straight to powershell.exe would flash one).
'   wscript calmx-hidden.vbs          -> start-calmx.ps1 -Background
'   wscript calmx-hidden.vbs stop     -> stop-calmx.ps1
Set shell = CreateObject("WScript.Shell")
root = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
script = "start-calmx.ps1"
extra = " -Background"
If WScript.Arguments.Count > 0 Then
    If WScript.Arguments(0) = "stop" Then
        script = "stop-calmx.ps1"
        extra = ""
    End If
End If
shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & root & "\" & script & """" & extra, 0, False
