#!/usr/bin/env bash
# 01-homebrew.sh — Install Homebrew and initialise shell env.
# NOTE: NOT run in a subshell — PATH exports must reach the outer shell.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_homebrew() {
  step "Homebrew"
  if ! command -v brew >/dev/null 2>&1; then
    info "Installing Homebrew..."
    # Supply chain note: this is the official installer piped to bash.
    # Pin the URL or verify checksum if stricter supply-chain control is needed.
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
      error "Homebrew installation failed."; log "Homebrew installation failed"; return 1
    }
    if ! grep -q 'brew shellenv' "$HOME/.zprofile" 2>/dev/null; then
      # Single quotes intentional: write the literal string to .zprofile, not the expanded value
      # shellcheck disable=SC2016
      { echo; echo 'eval "$(/opt/homebrew/bin/brew shellenv)"'; } >>"$HOME/.zprofile"
    fi
    success "Homebrew installed."; log "Homebrew installed"
  else
    success "Homebrew already installed."
  fi
  bootstrap_env
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_homebrew; }
