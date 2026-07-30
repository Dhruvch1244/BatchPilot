#!/usr/bin/env bash
# Launches BatchPilot and opens it in your default browser. Works on macOS
# and Linux. Ctrl+C in this terminal (or closing it) stops the server.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAR_PATH="$SCRIPT_DIR/BatchPilot.jar"
APP_URL="http://localhost:8743"

if ! command -v java >/dev/null 2>&1; then
  echo "Java was not found on this computer."
  echo "BatchPilot needs Java 17 or newer - install it from https://adoptium.net and try again."
  exit 1
fi

echo "Starting BatchPilot... this terminal is the server - keep it open"
echo "while you use the app, and press Ctrl+C whenever you want to stop it."
echo

(
  sleep 6
  if command -v open >/dev/null 2>&1; then
    open "$APP_URL"            # macOS
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$APP_URL"        # Linux
  else
    echo "Open $APP_URL in your browser."
  fi
) &

exec java -jar "$JAR_PATH"
