#!/usr/bin/env bash
# Builds a single-jar, single-port BatchPilot release: the Angular frontend
# is compiled and embedded into the Spring Boot backend's static resources,
# so the resulting jar is a self-contained app - just `java -jar` (or one of
# the launcher scripts in packaging/) and it serves both the UI and the API
# on one port, no separate frontend process, no npm/node needed by whoever
# runs the release.
#
# Usage: ./release.sh
# Output: release/BatchPilot.zip (and the unzipped release/ folder)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
STATIC_DIR="$BACKEND_DIR/src/main/resources/static"
RELEASE_DIR="$ROOT_DIR/release"
APP_NAME="BatchPilot"

echo "==> [1/5] Building frontend (production)"
cd "$FRONTEND_DIR"
npm install
npx ng build --configuration production

if [ ! -d "$FRONTEND_DIR/dist/frontend/browser" ]; then
  echo "error: expected frontend/dist/frontend/browser after the build - the" >&2
  echo "       Angular CLI's output layout may have changed; check ng build's" >&2
  echo "       'Output location' line above and update STATIC_DIR's source path." >&2
  exit 1
fi

echo "==> [2/5] Embedding frontend into backend static resources"
rm -rf "$STATIC_DIR"
mkdir -p "$STATIC_DIR"
cp -r "$FRONTEND_DIR/dist/frontend/browser/." "$STATIC_DIR/"

echo "==> [3/5] Building backend (executable jar)"
cd "$ROOT_DIR"
mvn -q clean package -pl backend -am

BACKEND_JAR="$BACKEND_DIR/target/batchpilot-backend.jar"
if [ ! -f "$BACKEND_JAR" ]; then
  echo "error: $BACKEND_JAR was not produced by the build" >&2
  exit 1
fi

echo "==> [4/5] Assembling release package"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
cp "$BACKEND_JAR" "$RELEASE_DIR/$APP_NAME.jar"
cp "$ROOT_DIR/packaging/windows/"*.bat "$RELEASE_DIR/"
cp "$ROOT_DIR/packaging/windows/"*.vbs "$RELEASE_DIR/"
cp "$ROOT_DIR/packaging/unix/"*.sh "$RELEASE_DIR/"
chmod +x "$RELEASE_DIR/"*.sh
cp "$ROOT_DIR/packaging/README.txt" "$RELEASE_DIR/"

cd "$ROOT_DIR"
rm -f "$APP_NAME.zip"
(cd "$RELEASE_DIR" && zip -rq "../$APP_NAME.zip" .)

echo
echo "Release ready:"
echo "  Folder: $RELEASE_DIR"
echo "  Zip:    $ROOT_DIR/$APP_NAME.zip  <- share this one file"

echo "==> [5/5] Copying release to Desktop"
# Most people never go looking in the repo checkout for the finished build,
# so drop a ready-to-run copy on the Desktop automatically. Works on Windows
# Git Bash/MSYS (via $USERPROFILE), WSL (via the Windows user's /mnt/c
# profile), and plain macOS/Linux (via $HOME/Desktop) - whichever resolves
# first wins; if none do, this step just skips itself.
DESKTOP_DIR=""
if [ -n "${USERPROFILE:-}" ] && command -v cygpath >/dev/null 2>&1; then
  DESKTOP_DIR="$(cygpath -u "$USERPROFILE")/Desktop"
elif [ -n "${USERPROFILE:-}" ]; then
  DESKTOP_DIR="$(printf '%s' "$USERPROFILE" | sed -E 's#\\#/#g; s#^([A-Za-z]):#/\L\1#')/Desktop"
elif [ -n "${WSL_DISTRO_NAME:-}" ] && [ -d "/mnt/c/Users" ]; then
  WIN_USER="$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r\n')"
  [ -n "$WIN_USER" ] && [ -d "/mnt/c/Users/$WIN_USER" ] && DESKTOP_DIR="/mnt/c/Users/$WIN_USER/Desktop"
elif [ -d "$HOME/Desktop" ]; then
  DESKTOP_DIR="$HOME/Desktop"
fi

if [ -n "$DESKTOP_DIR" ]; then
  mkdir -p "$DESKTOP_DIR"
  DESKTOP_RELEASE="$DESKTOP_DIR/$APP_NAME"
  rm -rf "$DESKTOP_RELEASE"
  cp -r "$RELEASE_DIR" "$DESKTOP_RELEASE"
  cp "$ROOT_DIR/$APP_NAME.zip" "$DESKTOP_DIR/"
  echo "  Folder: $DESKTOP_RELEASE  <- double-click BatchPilot.bat here to run it"
  echo "  Zip:    $DESKTOP_DIR/$APP_NAME.zip  <- this is the one file to share"
else
  echo "  note: could not auto-detect a Desktop folder, nothing copied there."
  echo "        Use the release/ folder or $APP_NAME.zip above instead."
fi

echo
echo "Whoever you send $APP_NAME.zip to just needs Java 17+ installed, then"
echo "unzip it and double-click BatchPilot.bat (Windows) or run ./run.sh"
echo "(macOS/Linux)."
