#!/usr/bin/env bash
# setup/main.sh — macOS setup entry point. Sources lib + all step files, runs them.
#
# Usage:
#   bash setup/main.sh              # full run (all 15 steps)
#   bash setup/main.sh homebrew     # single step by short name
#   bash setup/main.sh mac_defaults # underscores work too
#
# Each step can also be run standalone:
#   bash setup/04-dotfiles.sh

set -uo pipefail

SETUP_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SETUP_DIR/lib.sh"

# Source all numbered step files in order
for _f in "$SETUP_DIR"/[0-9][0-9]-*.sh; do
  # shellcheck source=/dev/null
  source "$_f"
done
unset _f

# Steps that abort the whole run on failure
CRITICAL_STEPS=(homebrew apps dotfiles node)

is_critical() {
  local s="$1"
  for c in "${CRITICAL_STEPS[@]}"; do [[ "$c" == "$s" ]] && return 0; done
  return 1
}

run_step() {
  local name="$1"
  local fn="set_${name}"
  if ! declare -f "$fn" >/dev/null 2>&1; then
    error "Unknown step: $name"
    echo "Available steps:"; declare -F | awk '{print $3}' | grep '^set_' | sed 's/^set_/  /'
    return 1
  fi
  if is_critical "$name"; then
    "$fn" || { error "Critical step '$name' failed — aborting."; log "Aborted at: $name"; exit 1; }
  else
    "$fn" || warn "Step '$name' failed — continuing."
  fi
}

# ─── Ordered step list ───────────────────────────────────────────────────────
STEPS=(
  homebrew      # 01 — Homebrew
  apps          # 02 — Formulae & casks
  store_apps    # 03 — App Store + DMG
  dotfiles      # 04 — stow dotfiles, seed pi + raycast settings, fetch pokemon
  git           # 05 — Global git config
  node          # 06 — fnm, Node LTS, pnpm
  nvim          # 07 — Neovim lazy.nvim bootstrap
  pi            # 08 — pi coding agent
  ai            # 09 — AI skills
  ssh           # 10 — SSH keys & config
  mac_cleanup   # 11 — Clear Dock, disable Siri/analytics
  mac_defaults  # 12 — Dock/Finder/keyboard/trackpad defaults
  network       # 13 — SMB LaunchAgents
  tmux_helpers  # 14 — Compile nowplaying binary + install tmux-battery/cpu scripts
  crontab       # 15 — Weekly maintenance crons
)

main() {
  echo -e "${BOLD}${BLUE}"
  echo "╔══════════════════════════════════════╗"
  echo "║         macOS Setup Script           ║"
  echo "╚══════════════════════════════════════╝"
  echo -e "${RESET}"
  log "Setup started"
  bootstrap_env

  # Single-step mode
  if [[ $# -gt 0 ]]; then
    local name="${1//-/_}"   # allow dashes or underscores
    info "Running single step: $name"
    run_step "$name"
    exit $?
  fi

  # Full run
  local total=${#STEPS[@]} current=0
  for s in "${STEPS[@]}"; do
    (( current++ )) || true
    echo -e "\n${CYAN}[${current}/${total}]${RESET}"
    run_step "$s"
  done

  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${GREEN}║   ✓  Setup complete!                 ║${RESET}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  ${YELLOW}Next steps:${RESET}"
  echo -e "  1. Paste SSH keys above into ${BLUE}github.com/settings/keys${RESET}"
  echo -e "  2. Set ${BLUE}ANTHROPIC_API_KEY${RESET} in your shell environment"
  echo -e "  3. Sign in to App Store if you skipped it"
  echo -e "  4. Open terrorCastle share — enter SMB credentials once in Keychain"
  echo -e "  5. Run ${BLUE}pokemon-bg${RESET} to set your first Ghostty background"
  echo ""
  echo -e "  Log: ${BLUE}~/setup.log${RESET}"
  echo ""
  log "Setup complete"
}

main "$@"
