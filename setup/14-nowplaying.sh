#!/usr/bin/env bash
# 14-nowplaying.sh — Compile the Swift nowplaying helper to a cached binary.
#
# The Swift script is executed via `#!/usr/bin/env swift` which triggers swiftc
# compilation on every invocation (~155 ms). Compiling once to a binary
# eliminates that cost. The nowplaying wrapper uses the binary when present.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_nowplaying() {
  step "Nowplaying Binary"

  local swift_src="$SCRIPTS_DIR/nowplaying_mediaremote.swift"
  local binary="$HOME/.local/bin/nowplaying-mediaremote"

  if [[ ! -f "$swift_src" ]]; then
    warn "Swift source not found: $swift_src — skipping compilation."
    log "nowplaying: Swift source missing"; return 0
  fi

  mkdir -p "$(dirname "$binary")"

  if [[ -f "$binary" && "$binary" -nt "$swift_src" ]]; then
    success "nowplaying binary is up to date."; return 0
  fi

  info "Compiling $swift_src..."
  if swiftc "$swift_src" -o "$binary" 2>/dev/null; then
    success "nowplaying binary compiled → $binary"
    log "nowplaying binary compiled"
  else
    warn "Compilation failed — tmux will fall back to Swift interpreter."
    log "nowplaying binary compilation failed (non-fatal)"
  fi
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_nowplaying; }
