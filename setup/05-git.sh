#!/usr/bin/env bash
# 05-git.sh — Configure global git settings.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_git() {
  (set -euo pipefail
  step "Git"
  git config --global user.name        "mahi160"
  git config --global user.email       "omarsifat288@gmail.com"
  git config --global core.editor      "nvim"
  git config --global init.defaultBranch "main"
  git config --global pull.rebase      false
  git config --global core.autocrlf    false
  success "Git configured."; log "Git configured"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_git; }
