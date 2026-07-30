@echo off
title Stop BatchPilot
setlocal

set "APP_DIR=%~dp0"
set "PID_FILE=%APP_DIR%batchpilot.pid"

rem Only needed if you started BatchPilot with BatchPilot-Silent.vbs.
rem If you started it with BatchPilot.bat, just close that window instead.

if not exist "%PID_FILE%" (
  echo No running BatchPilot instance found ^(no batchpilot.pid file^).
  echo If you started it with BatchPilot.bat, close that window instead.
  echo.
  pause
  exit /b 0
)

set /p BP_PID=<"%PID_FILE%"
taskkill /PID %BP_PID% /F >nul 2>nul
del "%PID_FILE%" >nul 2>nul

echo BatchPilot stopped.
echo.
pause
