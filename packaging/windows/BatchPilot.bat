@echo off
title BatchPilot
setlocal

set "APP_DIR=%~dp0"
set "APP_JAR=%APP_DIR%BatchPilot.jar"
set "APP_URL=http://localhost:8743"

echo ============================================
echo   BatchPilot
echo ============================================
echo.

where java >nul 2>nul
if errorlevel 1 (
  echo Java was not found on this computer.
  echo BatchPilot needs Java 17 or newer to run - install it from
  echo https://adoptium.net and try again.
  echo.
  pause
  exit /b 1
)

echo This window IS the BatchPilot server - keep it open while you use
echo the app. Closing this window stops BatchPilot.
echo.
echo Opening %APP_URL% in your browser in a few seconds...
echo.

start "" /min "%APP_DIR%_open-browser.bat"

java -jar "%APP_JAR%"

echo.
echo BatchPilot has stopped.
pause
