#!/bin/bash
# bootstrap.sh — Fresh Mac setup, one command.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mahi160/setthemacup/main/bootstrap.sh | bash
#
# What this does:
#   1. Installs Xcode Command Line Tools (needed for git, swiftc, clang)
#   2. Clones this repo to ~/.setup
#   3. Hands off to setup/main.sh for everything else
#
# Safe to re-run: skips steps that are already done.

set -euo pipefail

REPO_URL="https://github.com/mahi160/setthemacup.git"
REPO_DIR="$HOME/.setup"

# ─── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[32m'
BLUE='\033[34m'
YELLOW='\033[33m'
RESET='\033[0m'
info()    { echo -e "${BLUE}==> $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}! $*${RESET}"; }

# ─── 1. Xcode Command Line Tools ──────────────────────────────────────────────
if ! xcode-select -p &>/dev/null; then
  info "Installing Xcode Command Line Tools..."
  info "A dialog will appear — click Install and wait for it to finish."
  xcode-select --install 2>/dev/null || true
  info "Waiting for Xcode CLI tools..."
  until xcode-select -p &>/dev/null; do sleep 5; done
  success "Xcode Command Line Tools installed."
else
  success "Xcode Command Line Tools already installed."
fi

# ─── 2. Clone dotfiles repo ───────────────────────────────────────────────────
if [[ -d "$REPO_DIR/.git" ]]; then
  success "Repo already at $REPO_DIR — pulling latest..."
  git -C "$REPO_DIR" pull --ff-only || warn "git pull failed — continuing with local version."
else
  info "Cloning dotfiles to $REPO_DIR..."
  git clone "$REPO_URL" "$REPO_DIR"
  success "Repo cloned to $REPO_DIR"
fi

# Export so setup/main.sh and every script it sources knows the repo root
export SETTHEMACUP="$REPO_DIR"

# ─── 3. Hand off to setup/main.sh ────────────────────────────────────────────
info "Starting setup/main.sh..."
echo ""
exec bash "$REPO_DIR/setup/main.sh"