#!/usr/bin/env bash
# make-webapp.sh — Create a Brave-style .app bundle using app_mode_loader.
# Mirrors exactly what Brave creates when you "Install Page as App".
#
# Usage: make-webapp.sh <name> <url> [icon_url]

set -euo pipefail

NAME="${1:?Usage: make-webapp.sh <name> <url> [icon_url]}"
URL="${2:?Usage: make-webapp.sh <name> <url> [icon_url]}"
ICON_URL="${3:-}"

BRAVE_APP="/Applications/Brave Browser.app"
BRAVE_BUNDLE_VERSION=$(defaults read "$BRAVE_APP/Contents/Info.plist" CFBundleVersion 2>/dev/null || echo "1.0")
BRAVE_FRAMEWORK="$BRAVE_APP/Contents/Frameworks/Brave Browser Framework.framework/Versions/Current/Helpers"
APP_MODE_LOADER="$BRAVE_FRAMEWORK/app_mode_loader"

APPS_DIR="$HOME/Applications/Brave Browser Apps.localized"
APP_DIR="$APPS_DIR/${NAME}.app"

# Deterministic Chrome-extension-style ID: 32 chars a-p (hex digits 0-f → a-p)
APP_ID=$(echo -n "$NAME" | python3 -c "
import sys, hashlib
h = hashlib.sha256(sys.stdin.buffer.read()).hexdigest()[:32]
print(''.join(chr(ord('a') + int(c, 16)) for c in h))
")

USER_DATA_DIR="$HOME/Library/Application Support/BraveSoftware/Brave-Browser/-/Web Applications/_crx_${APP_ID}"
BUNDLE_ID="com.brave.Browser.app.${APP_ID}"

mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"
mkdir -p "$USER_DATA_DIR"

# ── app_mode_loader binary ────────────────────────────────────────────────────
if [[ -f "$APP_MODE_LOADER" ]]; then
  cp "$APP_MODE_LOADER" "$APP_DIR/Contents/MacOS/app_mode_loader"
  chmod +x "$APP_DIR/Contents/MacOS/app_mode_loader"
else
  # Fallback: shell script if Brave not installed yet
  cat > "$APP_DIR/Contents/MacOS/app_mode_loader" << SCRIPT
#!/usr/bin/env bash
exec "$BRAVE_APP/Contents/MacOS/Brave Browser" --app="$URL" --user-data-dir="$USER_DATA_DIR"
SCRIPT
  chmod +x "$APP_DIR/Contents/MacOS/app_mode_loader"
fi

# ── Info.plist ────────────────────────────────────────────────────────────────
cat > "$APP_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>  <string>en</string>
  <key>CFBundleExecutable</key>         <string>app_mode_loader</string>
  <key>CFBundleIconFile</key>           <string>app.icns</string>
  <key>CFBundleIdentifier</key>         <string>${BUNDLE_ID}</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key>               <string>${NAME}</string>
  <key>CFBundlePackageType</key>        <string>APPL</string>
  <key>CFBundleShortVersionString</key> <string></string>
  <key>CFBundleSignature</key>          <string>????</string>
  <key>CFBundleVersion</key>            <string>${BRAVE_BUNDLE_VERSION}</string>
  <key>CrAppModeIsAdhocSigned</key>     <true/>
  <key>CrAppModeShortcutID</key>        <string>${APP_ID}</string>
  <key>CrAppModeShortcutName</key>      <string>${NAME}</string>
  <key>CrAppModeShortcutURL</key>       <string>${URL}</string>
  <key>CrAppModeUserDataDir</key>       <string>${USER_DATA_DIR}</string>
  <key>CrBundleIdentifier</key>         <string>com.brave.Browser</string>
  <key>CrBundleVersion</key>            <string>${BRAVE_BUNDLE_VERSION}</string>
  <key>LSEnvironment</key>
  <dict><key>MallocNanoZone</key><string>0</string></dict>
  <key>LSHasLocalizedDisplayName</key>  <true/>
  <key>LSMinimumSystemVersion</key>     <string>12.0</string>
  <key>NSHighResolutionCapable</key>    <true/>
</dict>
</plist>
PLIST

# ── Icon ──────────────────────────────────────────────────────────────────────
if [[ -n "$ICON_URL" ]]; then
  TMP_PNG=$(mktemp /tmp/webapp-icon-XXXXXX).png
  if curl -fsSL --max-time 10 "$ICON_URL" -o "$TMP_PNG" 2>/dev/null \
     && [[ -s "$TMP_PNG" ]] \
     && file "$TMP_PNG" | grep -qi image; then
    ICONSET=$(mktemp -d /tmp/webapp-iconset-XXXXXX).iconset
    mkdir -p "$ICONSET"
    for size in 16 32 64 128 256 512; do
      sips -z $size        $size        "$TMP_PNG" --out "$ICONSET/icon_${size}x${size}.png"    &>/dev/null || true
      sips -z $((size*2)) $((size*2)) "$TMP_PNG" --out "$ICONSET/icon_${size}x${size}@2x.png" &>/dev/null || true
    done
    iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/app.icns" 2>/dev/null || true
  else
    warn "Icon fetch failed for $NAME — skipping icon."
  fi
  rm -rf "$TMP_PNG" "${TMP_PNG%.png}.iconset" 2>/dev/null || true
fi

echo "✓ Created: $APP_DIR"
