#!/usr/bin/env bash
# 02-apps.sh — Install Homebrew formulae and casks from apps.json.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_apps() {
  (set -euo pipefail
  step "Apps"
  info "Updating Homebrew..."
  brew update || warn "brew update failed — continuing with cached index."

  info "Installing formulae..."
  while IFS= read -r pkg; do
    [[ -z "$pkg" ]] && continue
    if brew list --formula "$pkg" &>/dev/null; then
      success "$pkg already installed."
    else
      info "Installing $pkg..."
      brew install "$pkg" || { warn "Failed: $pkg"; log "Failed formula: $pkg"; }
    fi
  done < <(apps_names formulae)

  info "Installing casks..."
  while IFS= read -r pkg; do
    [[ -z "$pkg" ]] && continue
    if brew list --cask "$pkg" &>/dev/null; then
      success "$pkg already installed."
    else
      info "Installing cask: $pkg..."
      brew install --cask "$pkg" || { warn "Failed cask: $pkg"; log "Failed cask: $pkg"; }
    fi
  done < <(apps_names casks)

  log "Apps installation complete"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_apps; }
