#!/usr/bin/env bash
# compile-nowplaying.sh — Pre-compile the tmux-nowplaying Swift script to a binary.
#
# The Swift script at nowplaying_mediaremote.swift is executed via `#!/usr/bin/env swift`
# which triggers swiftc compilation on EVERY invocation (~155ms). tmux status-interval
# calls it every N seconds, burning CPU continuously.
#
# This script compiles it once to a cached binary at ~/.local/bin/nowplaying-mediaremote.
# The nowplaying.sh wrapper automatically uses the binary when present.
#
# Usage:
#   bash scripts/compile-nowplaying.sh
#
# Re-run if the Swift source is updated. Safe to call from macinstall.sh.

set -euo pipefail

# Swift source lives in the dotfiles scripts/ dir (no plugin dependency)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/nowplaying_mediaremote.swift"
BINARY="$HOME/.local/bin/nowplaying-mediaremote"

if [[ ! -f "$SCRIPT" ]]; then
  echo "[compile-nowplaying] Swift source not found: $SCRIPT"
  exit 1
fi

mkdir -p "$(dirname "$BINARY")"

if [[ -f "$BINARY" && "$BINARY" -nt "$SCRIPT" ]]; then
  echo "[compile-nowplaying] Binary is up to date: $BINARY"
  exit 0
fi

echo "[compile-nowplaying] Compiling $SCRIPT ..."
if swiftc "$SCRIPT" -o "$BINARY" 2>/dev/null; then
  echo "[compile-nowplaying] Done: $BINARY"
else
  echo "[compile-nowplaying] Compilation failed. Falling back to interpreted script." >&2
  exit 1
fi
