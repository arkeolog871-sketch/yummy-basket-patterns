#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

if ! command -v java >/dev/null 2>&1; then
  echo "Java bulunamadı." >&2
  exit 1
fi

JAVA_BIN="$(readlink -f "$(command -v java)")"
export JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"

printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$ROOT/local.properties"

if [[ -x "$ROOT/gradlew" ]]; then
  "$ROOT/gradlew" --no-daemon :app:assembleRelease
else
  gradle --no-daemon :app:assembleRelease
fi

APK="$ROOT/app/build/outputs/apk/release/app-release.apk"
DEST="$(cd "$ROOT/.." && pwd)/public/silvan-cebimde.apk"
cp "$APK" "$DEST"
echo "APK kopyalandı: $DEST"
