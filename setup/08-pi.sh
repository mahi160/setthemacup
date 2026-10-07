#!/usr/bin/env bash
# 08-pi.sh — Install pi coding agent and its packages.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_pi() {
  (set -euo pipefail
  step "Pi"

  if ! command -v pnpm >/dev/null 2>&1; then
    error "pnpm not found — step 06-node may have failed."; return 1
  fi

  info "Installing pi coding agent..."
  pnpm add -g @earendil-works/pi-coding-agent \
    || { error "Failed to install pi."; log "Failed to install pi"; return 1; }
  success "pi installed."

  # Packages are declared in dotfiles/pi/.pi/agent/settings.json and pi installs
  # any missing ones on startup. Install up front so the first run is not blocked.
  info "Installing pi packages..."
  if pi install npm:@gotgenes/pi-anthropic-auth@2.0.1 >/dev/null 2>&1; then
    success "pi packages ready."
  else
    warn "pi package install failed — pi will retry on next startup."
  fi

  log "pi installed"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_pi; }
