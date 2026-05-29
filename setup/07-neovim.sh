#!/usr/bin/env bash
# 07-neovim.sh — Bootstrap Neovim lazy.nvim plugins headlessly.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_nvim() {
  (set -euo pipefail
  step "Neovim"

  if ! command -v nvim >/dev/null 2>&1; then
    error "nvim not found — was step 02-apps successful?"; return 1
  fi

  info "Syncing lazy.nvim plugins (first run may take a few minutes)..."
  if nvim --headless "+Lazy! sync" +qa 2>>"$LOG_FILE"; then
    success "Neovim plugins synced."
  else
    warn "Plugin sync had warnings — check :Lazy on first launch or $LOG_FILE."
  fi

  if nvim --headless "+Lazy! clean" +qa 2>>"$LOG_FILE"; then
    success "Disabled plugins cleaned."
  else
    warn "Lazy clean had warnings — check $LOG_FILE."
  fi

  log "Neovim bootstrap complete"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_nvim; }
