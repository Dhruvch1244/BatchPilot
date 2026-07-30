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

echo "==> [1/4] Building frontend (production)"
cd "$FRONTEND_DIR"
npm install
npx ng build --configuration production

if [ ! -d "$FRONTEND_DIR/dist/frontend/browser" ]; then
  echo "error: expected frontend/dist/frontend/browser after the build - the" >&2
  echo "       Angular CLI's output layout may have changed; check ng build's" >&2
  echo "       'Output location' line above and update STATIC_DIR's source path." >&2
  exit 1
fi

echo "==> [2/4] Embedding frontend into backend static resources"
rm -rf "$STATIC_DIR"
mkdir -p "$STATIC_DIR"
cp -r "$FRONTEND_DIR/dist/frontend/browser/." "$STATIC_DIR/"

echo "==> [3/4] Building backend (executable jar)"
cd "$ROOT_DIR"
mvn -q clean package -pl backend -am

BACKEND_JAR="$BACKEND_DIR/target/batchpilot-backend.jar"
if [ ! -f "$BACKEND_JAR" ]; then
  echo "error: $BACKEND_JAR was not produced by the build" >&2
  exit 1
fi

echo "==> [4/4] Assembling release package"
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
echo
echo "Whoever you send $APP_NAME.zip to just needs Java 17+ installed, then"
echo "unzip it and double-click BatchPilot.bat (Windows) or run ./run.sh"
echo "(macOS/Linux)."
