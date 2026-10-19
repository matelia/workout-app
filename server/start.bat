@echo off
REM Starts the snapshot server on port 8000 (all interfaces, so Tailscale can reach it).
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python -m uvicorn main:app --host 0.0.0.0 --port 8000
