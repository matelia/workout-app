@echo off
REM Stops the server started by start.bat or start-hidden.vbs (whatever is listening on port 8000).
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":8000 "') do taskkill /PID %%p /F
