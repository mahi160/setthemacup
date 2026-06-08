#!/usr/bin/env bash
# pi-notify-icon.sh — generate the π notification icon for the pi agent notifier.
#
# Does two things:
#   1. Renders a 512×512 PNG  → ~/.local/share/pi/notify-icon.png
#      (gruvbox-material dark bg, radial glow, gold π with drop shadow)
#   2. Patches terminal-notifier.app's bundled icon with the π icon so it
#      appears on the LEFT of every Notification Center banner (macOS 12+
#      sandboxes the app icon to the sending bundle; patching is the only fix).
#
# Re-run after: brew upgrade terminal-notifier
# Called automatically by setup/04-dotfiles.sh on fresh installs.
#
# Requires: qlmanage (macOS built-in), sips (macOS built-in), iconutil (macOS built-in)

set -euo pipefail

ICON_DIR="$HOME/.local/share/pi"
ICON_PATH="$ICON_DIR/notify-icon.png"

# ── Cleanup on exit ───────────────────────────────────────────────────────────
SVG=""
TMP_OUT=""
ICONSET=""
cleanup() {
  [[ -n "$SVG"     ]] && rm -f  "$SVG"
  [[ -n "$TMP_OUT" ]] && rm -rf "$TMP_OUT"
  [[ -n "$ICONSET" ]] && rm -rf "$ICONSET"
}
trap cleanup EXIT

mkdir -p "$ICON_DIR"

# ── 1. Render SVG → PNG ───────────────────────────────────────────────────────
SVG=$(mktemp /tmp/pi-notify-icon-XXXX.svg)
TMP_OUT=$(mktemp -d /tmp/pi-notify-icon-out-XXXX)

cat > "$SVG" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <!-- Gruvbox Material Dark palette:
         #1d2021 hard-dark bg  |  #3c3836 lighter centre  |  #d8a657 gold  |  #e78a4e orange -->

    <!-- radial gradient: slightly lighter centre → hard dark edge -->
    <radialGradient id="bg" cx="50%" cy="45%" r="55%">
      <stop offset="0%"   stop-color="#3c3836"/>
      <stop offset="100%" stop-color="#1d2021"/>
    </radialGradient>

    <!-- soft gold halo behind the π -->
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#d8a657" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#d8a657" stop-opacity="0"/>
    </radialGradient>

    <!-- orange drop-shadow under π -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="14"
                    flood-color="#e78a4e" flood-opacity="0.55"/>
    </filter>

    <!-- outer glow on the gold π -->
    <filter id="textglow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="512" height="512" rx="108" ry="108" fill="url(#bg)"/>
  <ellipse cx="256" cy="230" rx="200" ry="180" fill="url(#glow)"/>
  <rect width="512" height="512" rx="108" ry="108"
        fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>

  <!-- shadow pass -->
  <text x="256" y="370"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="370" font-weight="bold"
        fill="#e78a4e" fill-opacity="0.4"
        text-anchor="middle"
        filter="url(#shadow)">π</text>

  <!-- main gold π -->
  <text x="256" y="370"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="370" font-weight="bold"
        fill="#d8a657"
        text-anchor="middle"
        filter="url(#textglow)">π</text>
</svg>
SVGEOF

qlmanage -t -s 512 -o "$TMP_OUT" "$SVG" > /dev/null 2>&1

GENERATED="$TMP_OUT/$(basename "$SVG").png"
if [[ ! -f "$GENERATED" ]]; then
  echo "pi-notify-icon: qlmanage conversion failed" >&2
  exit 1
fi

cp "$GENERATED" "$ICON_PATH"
echo "pi-notify-icon: icon written → $ICON_PATH"

# ── 2. Patch terminal-notifier bundle icon ────────────────────────────────────
TN_APP=$(find /opt/homebrew /usr/local -name "terminal-notifier.app" -type d 2>/dev/null | head -1)

if [[ -z "$TN_APP" ]]; then
  echo "pi-notify-icon: terminal-notifier.app not found — skipping icon patch" >&2
  exit 0
fi

TN_ICNS="$TN_APP/Contents/Resources/Terminal.icns"
ICONSET_TMP=$(mktemp -d /tmp/pi-icon-XXXX)
ICONSET="${ICONSET_TMP}.iconset"
mv "$ICONSET_TMP" "$ICONSET"

sips -z 16   16   "$ICON_PATH" --out "$ICONSET/icon_16x16.png"      > /dev/null 2>&1
sips -z 32   32   "$ICON_PATH" --out "$ICONSET/icon_16x16@2x.png"   > /dev/null 2>&1
sips -z 32   32   "$ICON_PATH" --out "$ICONSET/icon_32x32.png"       > /dev/null 2>&1
sips -z 64   64   "$ICON_PATH" --out "$ICONSET/icon_32x32@2x.png"   > /dev/null 2>&1
sips -z 128  128  "$ICON_PATH" --out "$ICONSET/icon_128x128.png"     > /dev/null 2>&1
sips -z 256  256  "$ICON_PATH" --out "$ICONSET/icon_128x128@2x.png" > /dev/null 2>&1
sips -z 256  256  "$ICON_PATH" --out "$ICONSET/icon_256x256.png"     > /dev/null 2>&1
sips -z 512  512  "$ICON_PATH" --out "$ICONSET/icon_256x256@2x.png" > /dev/null 2>&1
sips -z 512  512  "$ICON_PATH" --out "$ICONSET/icon_512x512.png"     > /dev/null 2>&1

if ! iconutil -c icns "$ICONSET" -o /tmp/pi-notify-patch.icns > /dev/null 2>&1; then
  echo "pi-notify-icon: iconutil failed — terminal-notifier icon not patched" >&2
  exit 1
fi

[[ ! -f "${TN_ICNS}.bak" ]] && cp "$TN_ICNS" "${TN_ICNS}.bak"
cp /tmp/pi-notify-patch.icns "$TN_ICNS"
killall NotificationCenter > /dev/null 2>&1 || true
echo "pi-notify-icon: terminal-notifier icon patched → $TN_ICNS"
