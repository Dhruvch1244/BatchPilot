@echo off
rem Helper used by BatchPilot.bat: waits for the server to finish starting,
rem then opens it in the default browser. Not meant to be run directly.
timeout /t 6 /nobreak >nul
start "" "http://localhost:8743"
