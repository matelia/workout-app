' Starts the server with no console window and logs to server.log.
' A shortcut to this file in the Startup folder runs it at every Windows sign-in.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
sh.Run "cmd /c """"" & dir & "\.venv\Scripts\python.exe"" -m uvicorn main:app --host 0.0.0.0 --port 8000 > """ & dir & "\server.log"" 2>&1""", 0, False
' Cloudflare tunnel + gist (tunnel.ps1 does nothing unless ENABLE_TUNNEL=true in .env).
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\tunnel.ps1""", 0, False
