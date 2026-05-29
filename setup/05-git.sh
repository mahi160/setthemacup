#!/usr/bin/env bash
# 05-git.sh — Configure global git settings.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_git() {
  (set -euo pipefail
  step "Git"
  # Identity
  git config --global user.name          "mahi160"
  git config --global user.email         "omarsifat288@gmail.com"

  # Core
  git config --global core.editor        "nvim"
  git config --global core.autocrlf      false
  git config --global core.excludesfile  "$HOME/.gitignore_global"

  # Branches & remotes
  git config --global init.defaultBranch "main"
  git config --global pull.rebase        false
  git config --global push.autoSetupRemote true   # no more 'set upstream' errors
  git config --global fetch.prune        true     # auto-delete stale remote-tracking branches
  git config --global rebase.autoStash   true     # stash dirty tree before rebase automatically

  # Delta pager (syntax-highlighted diffs)
  git config --global core.pager                 "delta"
  git config --global interactive.diffFilter     "delta --color-only"
  git config --global delta.navigate             true
  git config --global delta.side-by-side         true
  git config --global delta.line-numbers         true
  git config --global delta.syntax-theme         "gruvbox-dark"

  success "Git configured."; log "Git configured"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_git; }
