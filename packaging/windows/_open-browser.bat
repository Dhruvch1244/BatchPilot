@echo off
rem Helper used by BatchPilot.bat: waits for the server to finish starting,
rem then opens it in the default browser. Not meant to be run directly.
rem
rem The server auto-picks a different port if 8743 is already taken by
rem something else on this machine and writes the one it actually used to
rem port.txt - read that if present so the right URL opens either way.
timeout /t 6 /nobreak >nul

set "APP_PORT=8743"
set "PORT_FILE=%USERPROFILE%\.batchpilot\port.txt"
if exist "%PORT_FILE%" (
  set /p APP_PORT=<"%PORT_FILE%"
)

start "" "http://localhost:%APP_PORT%"
