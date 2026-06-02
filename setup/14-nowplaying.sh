#!/usr/bin/env bash
# 14-nowplaying.sh — Compile Swift nowplaying binary + install tmux status bar scripts.
#
# Installs three helpers to ~/.local/bin/:
#   nowplaying-mediaremote  compiled Swift binary (~5ms vs 155ms interpreted)
#   tmux-battery            battery icon + % via pmset
#   tmux-cpu                cpu icon + % via ps + sysctl
#   tmux-nowplaying         now playing via nowplaying-cli

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_tmux_helpers() {
  step "Tmux Helpers"

  mkdir -p "$HOME/.local/bin"

  # ── Nowplaying Swift binary ────────────────────────────────────────────────
  local swift_src="$SCRIPTS_DIR/nowplaying_mediaremote.swift"
  local binary="$HOME/.local/bin/nowplaying-mediaremote"

  if [[ ! -f "$swift_src" ]]; then
    warn "Swift source not found: $swift_src — skipping compilation."
    log "nowplaying: Swift source missing"
  elif [[ -f "$binary" && "$binary" -nt "$swift_src" ]]; then
    success "nowplaying binary is up to date."
  else
    info "Compiling $swift_src..."
    if swiftc "$swift_src" -o "$binary" 2>/dev/null; then
      success "nowplaying binary compiled → $binary"
      log "nowplaying binary compiled"
    else
      warn "Compilation failed — tmux will fall back to Swift interpreter."
      log "nowplaying binary compilation failed (non-fatal)"
    fi
  fi

  # ── tmux-battery + tmux-cpu shell scripts ─────────────────────────────────
  for script in tmux-battery tmux-cpu tmux-nowplaying; do
    local src="$SCRIPTS_DIR/${script}.sh"
    local dst="$HOME/.local/bin/${script}"
    if [[ -f "$src" ]]; then
      cp "$src" "$dst" && chmod +x "$dst"
      success "${script} installed to ~/.local/bin/"; log "${script} installed"
    else
      warn "${script}.sh not found in scripts/ — skipping."; log "${script}.sh missing"
    fi
  done
}

# Allow running this file standalone
[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_tmux_helpers; }
