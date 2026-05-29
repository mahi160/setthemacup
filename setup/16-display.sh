#!/usr/bin/env bash
# 16-display.sh — Set display scaling to "More Space" (1920×1200 HiDPI).
# Compiles set-display-resolution Swift binary if needed, then applies immediately.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_display() {
  step "Display"

  local bin="$HOME/.local/bin/set-display-resolution"
  local src="$SETUP_DIR/scripts/set-display-resolution.swift"

  # Compile if missing or source is newer
  if [[ ! -x "$bin" || "$src" -nt "$bin" ]]; then
    info "Compiling set-display-resolution..."
    mkdir -p "$HOME/.local/bin"
    swiftc "$src" -o "$bin" || { warn "Swift compile failed — skipping display step."; return 0; }
    success "Compiled → $bin"
  fi

  "$bin" 1710 1112 && success "Display set to More Space (1710×1112 HiDPI)." \
                   || warn "Could not set display resolution."

  log "Display scaling set to 1710×1112"
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_display; }
