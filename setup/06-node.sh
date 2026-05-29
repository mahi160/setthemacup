#!/usr/bin/env bash
# 06-node.sh — Install fnm, Node LTS, and pnpm.
# NOTE: NOT run in a subshell — PATH exports must reach the outer shell.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_node() {
  step "Node"

  if ! command -v fnm >/dev/null 2>&1; then
    info "Installing fnm..."
    brew install fnm || { error "Failed to install fnm."; log "Failed to install fnm"; return 1; }
  fi

  eval "$(fnm env --use-on-cd --shell bash)"
  fnm install --lts  || { error "Failed to install LTS Node."; log "Failed to install LTS Node"; return 1; }
  fnm use lts-latest
  fnm alias default lts-latest
  success "Node $(node -v) active."

  if ! command -v pnpm >/dev/null 2>&1; then
    npm install -g pnpm || { error "Failed to install pnpm."; log "Failed to install pnpm"; return 1; }
    success "pnpm installed."
  else
    success "pnpm $(pnpm -v) already installed."
  fi

  bootstrap_env
  log "Node setup complete"
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_node; }
