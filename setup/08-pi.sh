#!/usr/bin/env bash
# 08-pi.sh — Install pi coding agent and its Claude extension.

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

  local claude_ext="$HOME/.pi/agent/extensions/claude"
  if [[ -f "$claude_ext/package.json" ]]; then
    info "Installing pi claude extension dependencies..."
    if (cd "$claude_ext" && pnpm install --frozen-lockfile 2>/dev/null); then
      success "pi claude extension ready."
    else
      warn "pi claude extension install failed."
    fi
  fi

  log "pi installed"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_pi; }
