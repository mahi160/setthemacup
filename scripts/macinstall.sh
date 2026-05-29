#!/usr/bin/env bash
# macinstall.sh — Full macOS dev environment setup.
#
# Runs 15 steps in order. Safe to re-run — every step checks before acting.
#
# Usage:
#   bash scripts/macinstall.sh            # full run
#   bash scripts/macinstall.sh set_node   # single step

# ─── Strict mode (applied per-function, not globally) ─────────────────────────
# We DON'T use `set -euo pipefail` at top level — it causes the whole script to
# abort on the first warning in any subshell. Each function sets it locally, so
# errors inside a step are contained and handled gracefully.

DOTFILES_DIR="$(cd "$(dirname "$0")/../dotfiles" && pwd)"
APPS_JSON="$(cd "$(dirname "$0")" && pwd)/apps.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export SETTHEMACUP="$REPO_DIR"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
CYAN='\033[36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}==> $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}! $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}"; }
step()    { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }

# ─── Logging ──────────────────────────────────────────────────────────────────
LOG_FILE="$HOME/setup.log"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$LOG_FILE" 2>/dev/null || true; }

# ─── JSON helpers ─────────────────────────────────────────────────────────────
apps_names() {
  python3 -c "
import json, sys
with open('${APPS_JSON}') as f:
    data = json.load(f)
for item in data.get('${1}', []):
    print(item['name'])
"
}

apps_pairs() {
  python3 -c "
import json
with open('${APPS_JSON}') as f:
    data = json.load(f)
for item in data.get('${1}', []):
    print(item['${2}'] + ':' + item['name'])
"
}

apps_dmg() {
  python3 -c "
import json
with open('${APPS_JSON}') as f:
    data = json.load(f)
for item in data.get('dmg', []):
    print(item['name'] + '|' + item['url'])
"
}

# ─── Environment bootstrap ────────────────────────────────────────────────────
# Ensures brew, fnm, pnpm, and npm globals are on PATH for the duration of this
# script, regardless of what's in .zshrc (which isn't sourced in bash).
bootstrap_env() {
  # Homebrew
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi

  # fnm
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --use-on-cd --shell bash 2>/dev/null)" || true
  fi

  # pnpm
  export PNPM_HOME="$HOME/Library/pnpm"
  case ":$PATH:" in
    *":$PNPM_HOME/bin:"*) ;;
    *) export PATH="$PNPM_HOME/bin:$PATH" ;;
  esac

  # npm global bin (fallback for pnpm if it was installed via npm -g)
  if command -v npm >/dev/null 2>&1; then
    local npm_bin
    npm_bin="$(npm config get prefix 2>/dev/null)/bin"
    case ":$PATH:" in
      *":$npm_bin:"*) ;;
      *) export PATH="$npm_bin:$PATH" ;;
    esac
  fi
}

# ─── 1. Homebrew ──────────────────────────────────────────────────────────────
set_homebrew() {
  (set -euo pipefail
  step "Homebrew"

  if ! command -v brew >/dev/null 2>&1; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
      error "Homebrew installation failed."
      log "Homebrew installation failed"
      return 1
    }
    # Write to .zprofile so brew is on PATH in future interactive shells
    {
      echo
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"'
    } >>"$HOME/.zprofile"
    success "Homebrew installed."
    log "Homebrew installed"
  else
    success "Homebrew already installed."
  fi

  # Make brew available for the rest of this script immediately
  bootstrap_env
  )
}

# ─── 2. Apps ──────────────────────────────────────────────────────────────────
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

# ─── 3. Store & Direct Apps ───────────────────────────────────────────────────
install_dmg() {
  local name="$1" url="$2"
  if [[ -d "/Applications/$name.app" ]]; then
    success "$name already installed."
    return 0
  fi
  info "Downloading $name..."
  local tmp
  tmp="$(mktemp /tmp/$name.XXXXXX.dmg)"
  curl -L --progress-bar "$url" -o "$tmp" || {
    warn "Failed to download $name."
    rm -f "$tmp"
    return 1
  }
  local volume
  volume="$(hdiutil attach "$tmp" -nobrowse -quiet | awk 'END{print $NF}')"
  local app
  app="$(find "$volume" -maxdepth 1 -name '*.app' | head -1)"
  if [[ -n "$app" ]]; then
    cp -R "$app" /Applications/
    success "$name installed."
  else
    warn "No .app found in $name DMG."
  fi
  hdiutil detach "$volume" -quiet 2>/dev/null || true
  rm -f "$tmp"
}

set_store_apps() {
  (set -euo pipefail
  step "Store & Direct Apps"

  if ! mas account &>/dev/null; then
    warn "Not signed in to App Store — skipping mas installs. Sign in via App Store app first."
  else
    while IFS=':' read -r id name; do
      [[ -z "$id" ]] && continue
      if mas list | grep -q "^$id"; then
        success "$name already installed."
      else
        info "Installing $name..."
        mas install "$id" || warn "Failed to install $name."
      fi
    done < <(apps_pairs mas id)
  fi

  info "Installing direct download apps..."
  while IFS='|' read -r name url; do
    [[ -z "$name" ]] && continue
    install_dmg "$name" "$url" || true
  done < <(apps_dmg)

  log "Store & direct apps complete"
  )
}

# ─── 4. Dotfiles ──────────────────────────────────────────────────────────────
set_dotfiles() {
  (set -euo pipefail
  step "Dotfiles"

  # oh-my-zsh
  if [[ ! -d "$HOME/.oh-my-zsh" ]]; then
    info "Installing oh-my-zsh..."
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended || {
      error "oh-my-zsh installation failed."
      log "oh-my-zsh installation failed"
      return 1
    }
    success "oh-my-zsh installed."
    log "oh-my-zsh installed"
  else
    success "oh-my-zsh already installed."
  fi

  # zsh plugins
  local zsh_custom="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"
  local plugins=(
    "zsh-users/zsh-autosuggestions"
    "zsh-users/zsh-syntax-highlighting"
  )
  for plugin in "${plugins[@]}"; do
    local dest="$zsh_custom/plugins/${plugin##*/}"
    if [[ ! -d "$dest" ]]; then
      git clone "https://github.com/$plugin" "$dest" || {
        warn "Failed to clone $plugin."
        log "Failed to clone $plugin"
      }
    else
      success "Plugin ${plugin##*/} already installed."
    fi
  done

  # stow dotfiles
  info "Stowing dotfiles from $DOTFILES_DIR..."
  local packages=(fastfetch ghostty nvim pi starship stow tmux zsh)
  for pkg in "${packages[@]}"; do
    # Back up any files that would conflict
    local conflicts
    conflicts=$(
      stow --dir="$DOTFILES_DIR" --target="$HOME" --simulate "$pkg" 2>&1 |
        grep "existing target" |
        awk '{print $NF}' ||
        true
    )
    for f in $conflicts; do
      if [[ -e "$HOME/$f" && ! -L "$HOME/$f" ]]; then
        mv "$HOME/$f" "$HOME/$f.bak"
        warn "Backed up ~/$f → ~/$f.bak"
      fi
    done
    stow --dir="$DOTFILES_DIR" --target="$HOME" "$pkg" || {
      warn "Failed to stow $pkg."
      log "Failed to stow $pkg"
    }
    success "Stowed $pkg."
  done

  # TPM
  local tpm_dir="$HOME/.config/tmux/plugins/tpm"
  if [[ ! -d "$tpm_dir" ]]; then
    info "Cloning TPM..."
    git clone --depth=1 https://github.com/tmux-plugins/tpm "$tpm_dir" || {
      warn "TPM clone failed — tmux plugins will not be installed."
      log "TPM clone failed"
    }
  fi
  local tpm_install="$tpm_dir/bin/install_plugins"
  if [[ -f "$tpm_install" ]]; then
    info "Installing tmux plugins..."
    "$tpm_install" && success "tmux plugins installed." || warn "tmux plugin install failed."
  fi

  log "Dotfiles setup complete"
  )
}

# ─── 5. Git ───────────────────────────────────────────────────────────────────
set_git() {
  (set -euo pipefail
  step "Git"

  git config --global user.name  "mahi160"
  git config --global user.email "omarsifat288@gmail.com"
  git config --global core.editor "nvim"
  git config --global init.defaultBranch "main"
  git config --global pull.rebase false
  git config --global core.autocrlf false

  success "Git configured."
  log "Git configured"
  )
}

# ─── 6. Node ──────────────────────────────────────────────────────────────────
set_node() {
  (set -euo pipefail
  step "Node"

  if ! command -v fnm >/dev/null 2>&1; then
    info "Installing fnm..."
    brew install fnm || {
      error "Failed to install fnm."
      log "Failed to install fnm"
      return 1
    }
  fi

  # Init fnm in bash (not zsh — this script runs in bash)
  eval "$(fnm env --use-on-cd --shell bash)"

  fnm install --lts || {
    error "Failed to install LTS Node."
    log "Failed to install LTS Node"
    return 1
  }
  fnm use lts-latest
  fnm alias default lts-latest
  success "Node $(node -v) active."

  # pnpm
  if ! command -v pnpm >/dev/null 2>&1; then
    npm install -g pnpm || {
      error "Failed to install pnpm."
      log "Failed to install pnpm"
      return 1
    }
    success "pnpm installed."
  else
    success "pnpm $(pnpm -v) already installed."
  fi

  # Make pnpm available for subsequent steps in this script
  export PNPM_HOME="$HOME/Library/pnpm"
  case ":$PATH:" in
    *":$PNPM_HOME/bin:"*) ;;
    *) export PATH="$PNPM_HOME/bin:$PATH" ;;
  esac

  log "Node setup complete"
  )

  # Re-run bootstrap_env so the outer shell picks up the newly installed tools
  bootstrap_env
}

# ─── 7. Neovim ────────────────────────────────────────────────────────────────
set_nvim() {
  (set -euo pipefail
  step "Neovim"

  if ! command -v nvim >/dev/null 2>&1; then
    error "nvim not found — ensure set_apps ran successfully."
    return 1
  fi

  info "Syncing lazy.nvim plugins (first run may take a few minutes)..."
  nvim --headless "+Lazy! sync" +qa 2>/dev/null &&
    success "Neovim plugins synced." ||
    warn "Plugin sync had warnings — check :Lazy on first launch."

  nvim --headless "+Lazy! clean" +qa 2>/dev/null &&
    success "Disabled plugins cleaned." ||
    warn "Lazy clean had warnings."

  log "Neovim bootstrap complete"
  )
}

# ─── 8. Pi ────────────────────────────────────────────────────────────────────
set_pi() {
  (set -euo pipefail
  step "Pi"

  if ! command -v pnpm >/dev/null 2>&1; then
    error "pnpm not found — set_node may have failed."
    return 1
  fi

  info "Installing pi coding agent..."
  pnpm add -g @earendil-works/pi-coding-agent || {
    error "Failed to install pi."
    log "Failed to install pi"
    return 1
  }
  success "pi installed."

  # Install pi claude extension dependencies (gitignored, must be installed at setup time)
  local claude_ext="$HOME/.pi/agent/extensions/claude"
  if [[ -f "$claude_ext/package.json" ]]; then
    info "Installing pi claude extension dependencies..."
    (cd "$claude_ext" && pnpm install --frozen-lockfile 2>/dev/null) &&
      success "pi claude extension ready." ||
      warn "pi claude extension pnpm install failed — extension may not load."
  fi

  log "pi installed"
  )
}

# ─── 9. AI Skills ─────────────────────────────────────────────────────────────
set_ai() {
  (set -euo pipefail
  step "AI Skills"

  if ! command -v npx >/dev/null 2>&1; then
    warn "npx not found — skipping AI skills. Run 'npx skills add <source>' manually."
    return 0
  fi

  while IFS='|' read -r source desc; do
    [[ -z "$source" ]] && continue
    info "  $source — $desc"
    npx --yes skills add "$source" 2>/dev/null \
      && success "Installed: $source" \
      || warn "Failed: $source  →  retry manually: npx skills add $source"
  done < <(python3 -c "
import json
with open('${APPS_JSON}') as f:
    data = json.load(f)
for s in data.get('ai_skills', []):
    print(s['source'] + '|' + s['desc'])
")

  log "AI skills installed"
  )
}

# ─── 10. SSH ──────────────────────────────────────────────────────────────────
set_ssh() {
  (set -euo pipefail
  step "SSH"

  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"

  local ssh_keys=(
    "id_ed25519:omarsifat288@gmail.com"
    "qp_ed25519:salauddin.sifat@questionpro.com"
  )

  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename comment <<<"$key"
    if [[ ! -f "$HOME/.ssh/$filename" ]]; then
      # -N "" = no passphrase; remove if you want one
      ssh-keygen -t ed25519 -C "$comment" -f "$HOME/.ssh/$filename" -N "" || {
        warn "Failed to generate SSH key $filename."
        log "Failed to generate SSH key $filename"
      }
      success "Generated $filename."
    else
      success "SSH key $filename already exists."
    fi
  done

  cat >"$HOME/.ssh/config" <<'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519

Host qp.github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/qp_ed25519
EOF
  chmod 600 "$HOME/.ssh/config"

  # Add keys to macOS Keychain agent
  eval "$(ssh-agent -s)" >/dev/null
  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename _ <<<"$key"
    if [[ -f "$HOME/.ssh/$filename" ]]; then
      ssh-add --apple-use-keychain "$HOME/.ssh/$filename" 2>/dev/null ||
        ssh-add "$HOME/.ssh/$filename" 2>/dev/null ||
        warn "Could not add $filename to agent."
    fi
  done

  echo ""
  info "Add these public keys to GitHub:"
  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename comment <<<"$key"
    if [[ -f "$HOME/.ssh/$filename.pub" ]]; then
      echo -e "  ${YELLOW}[$comment]${RESET}"
      echo "  $(cat "$HOME/.ssh/$filename.pub")"
      echo ""
    fi
  done

  success "SSH setup complete."
  log "SSH setup complete"
  )
}

# ─── 11. Mac Cleanup ──────────────────────────────────────────────────────────
set_mac_cleanup() {
  (set -euo pipefail
  step "Mac Cleanup"

  defaults write com.apple.dock persistent-apps   -array
  defaults write com.apple.dock persistent-others -array
  killall Dock 2>/dev/null || true
  success "Dock cleared."

  defaults write com.apple.assistant.support "Assistant Enabled" -bool false
  defaults write com.apple.Siri StatusMenuVisible     -bool false
  defaults write com.apple.Siri UserHasDeclinedEnable -bool true
  success "Siri disabled."

  defaults write com.apple.gamed Disabled -bool true
  success "Game Center disabled."

  defaults write com.apple.spotlight orderedItems -array \
    '{"enabled"=1;"name"="APPLICATIONS";}' \
    '{"enabled"=1;"name"="SYSTEM_PREFS";}' \
    '{"enabled"=1;"name"="DIRECTORIES";}' \
    '{"enabled"=1;"name"="PDF";}' \
    '{"enabled"=1;"name"="FONTS";}' \
    '{"enabled"=0;"name"="DOCUMENTS";}' \
    '{"enabled"=0;"name"="MESSAGES";}' \
    '{"enabled"=0;"name"="CONTACT";}' \
    '{"enabled"=0;"name"="EVENT_TODO";}' \
    '{"enabled"=0;"name"="IMAGES";}' \
    '{"enabled"=0;"name"="BOOKMARKS";}' \
    '{"enabled"=0;"name"="MUSIC";}' \
    '{"enabled"=0;"name"="MOVIES";}' \
    '{"enabled"=0;"name"="PRESENTATIONS";}' \
    '{"enabled"=0;"name"="SPREADSHEETS";}' \
    '{"enabled"=0;"name"="SOURCE";}' \
    '{"enabled"=0;"name"="MENU_DEFINITION";}' \
    '{"enabled"=0;"name"="MENU_OTHER";}' \
    '{"enabled"=0;"name"="MENU_CONVERSION";}' \
    '{"enabled"=0;"name"="MENU_EXPRESSION";}' \
    '{"enabled"=0;"name"="MENU_WEBSEARCH";}' \
    '{"enabled"=0;"name"="MENU_SPOTLIGHT_SUGGESTIONS";}'
  killall mds 2>/dev/null || true
  success "Spotlight suggestions disabled."

  defaults write com.apple.DiagnosticReportingSupport AutoSubmit -bool false
  defaults write com.apple.CrashReporter DialogType -string "none"
  defaults write com.apple.SubmitDiagInfo AutoSubmit -bool false 2>/dev/null || true
  success "Analytics & crash reporting disabled."

  for dir in "$HOME/Public" "$HOME/Sites"; do
    if [[ -d "$dir" && -z "$(ls -A "$dir")" ]]; then
      rmdir "$dir" && success "Removed empty $dir."
    elif [[ -d "$dir" ]]; then
      warn "$dir not empty, skipping."
    fi
  done

  log "Mac cleanup complete"
  )
}

# ─── 12. Mac Defaults ─────────────────────────────────────────────────────────
set_mac_defaults() {
  (set -euo pipefail
  step "Mac Defaults"

  # Dock
  defaults write com.apple.dock autohide               -bool true
  defaults write com.apple.dock autohide-delay          -float 0
  defaults write com.apple.dock autohide-time-modifier  -int 0
  defaults write com.apple.dock show-recents            -bool false
  defaults write com.apple.dock static-only             -bool true
  defaults write com.apple.dock expose-group-apps       -bool true
  defaults write com.apple.dock tilesize                -int 42
  killall Dock 2>/dev/null || true

  # Finder
  defaults write com.apple.finder FXPreferredViewStyle  -string "icnv"
  defaults write com.apple.finder ShowPathbar           -bool true
  defaults write com.apple.finder ShowStatusBar         -bool true
  defaults write NSGlobalDomain AppleShowAllExtensions  -bool true
  defaults write com.apple.finder AppleShowAllFiles     -bool true
  defaults write com.apple.finder NewWindowTarget       -string "PfHm"
  defaults write com.apple.finder FXDefaultSearchScope  -string "SCcf"
  # Don't create .DS_Store on network or USB volumes
  defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
  defaults write com.apple.desktopservices DSDontWriteUSBStores     -bool true
  killall Finder 2>/dev/null || true

  # Keyboard
  defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false
  defaults write NSGlobalDomain InitialKeyRepeat         -int 15
  defaults write NSGlobalDomain KeyRepeat                -int 2
  defaults write NSGlobalDomain AppleKeyboardUIMode      -int 2

  # Trackpad
  defaults write NSGlobalDomain com.apple.trackpad.scaling      -float 2
  defaults write NSGlobalDomain com.apple.trackpad.forceClick   -bool true
  defaults write NSGlobalDomain AppleEnableSwipeNavigateWithScrolls -bool false

  # Screenshots — save to ~/Downloads instead of desktop
  defaults write com.apple.screencapture location -string "$HOME/Downloads"
  defaults write com.apple.screencapture type     -string "png"
  defaults write com.apple.screencapture disable-shadow -bool true

  # Menu bar
  defaults write NSGlobalDomain _HIHideMenuBar -bool false

  # Spaces
  defaults write com.apple.spaces spans-displays -bool false
  killall SystemUIServer 2>/dev/null || true

  success "macOS defaults applied."
  log "macOS defaults applied"
  )
}

# ─── 13. Network Shares ───────────────────────────────────────────────────────
set_network_shares() {
  (set -euo pipefail
  step "Network Shares"

  mkdir -p "$HOME/Library/LaunchAgents"

  while IFS='|' read -r name url; do
    [[ -z "$name" ]] && continue
    local label="com.mahi.mount.$(echo "$name" | tr '[:upper:]' '[:lower:]')"
    local plist="$HOME/Library/LaunchAgents/${label}.plist"

    cat >"$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>sleep 5; mount | grep -q '${url}' || /usr/bin/osascript -e 'mount volume "${url}"'</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/${name}-mount.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/${name}-mount.log</string>
</dict>
</plist>
PLIST

    launchctl unload "$plist" 2>/dev/null || true
    launchctl load  "$plist"
    success "${name} (${url}) — auto-mounts on login."
    log "Network share configured: $name"
  done < <(python3 -c "
import json
with open('${APPS_JSON}') as f:
    data = json.load(f)
for s in data.get('smb', []):
    print(s['name'] + '|' + s['url'])
")

  log "Network shares complete"
  )
}

# ─── 14. Nowplaying Binary ────────────────────────────────────────────────────
set_nowplaying_binary() {
  step "Nowplaying Binary"
  if bash "${SCRIPT_DIR}/compile-nowplaying.sh"; then
    success "nowplaying binary compiled."
    log "nowplaying binary compiled"
  else
    warn "nowplaying binary compilation failed — tmux will fall back to Swift interpreter."
    log "nowplaying binary compilation failed (non-fatal)"
  fi
}

# ─── 15. Crontab ──────────────────────────────────────────────────────────────
set_crontab() {
  step "Crontab"
  bash "${SCRIPT_DIR}/crontab-setup.sh" &&
    success "Cron jobs installed." ||
    warn "Cron setup failed — run scripts/crontab-setup.sh manually."
  log "Crontab setup complete"
}

# ─── Step runner ──────────────────────────────────────────────────────────────
# Critical steps abort on failure. Non-critical steps warn and continue.
CRITICAL_STEPS=(set_homebrew set_apps set_dotfiles set_node)

is_critical() {
  local step="$1"
  for s in "${CRITICAL_STEPS[@]}"; do
    [[ "$s" == "$step" ]] && return 0
  done
  return 1
}

run_step() {
  local fn="$1"
  if is_critical "$fn"; then
    $fn || {
      error "Critical step '$fn' failed — aborting."
      log "Aborted at critical step: $fn"
      exit 1
    }
  else
    $fn || warn "Step '$fn' failed — continuing with remaining steps."
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  echo -e "${BOLD}${BLUE}"
  echo "╔══════════════════════════════════════╗"
  echo "║         macOS Setup Script           ║"
  echo "╚══════════════════════════════════════╝"
  echo -e "${RESET}"
  log "Setup started"

  # Bootstrap env early so brew/fnm/pnpm are available if re-running on
  # a machine that already has them installed
  bootstrap_env

  # If a single step name is passed as an argument, run only that step
  if [[ $# -gt 0 ]]; then
    if declare -f "$1" >/dev/null 2>&1; then
      info "Running single step: $1"
      "$1"
      exit $?
    else
      error "Unknown step: $1"
      echo "Available steps:"
      declare -F | awk '{print "  "$3}' | grep "^  set_"
      exit 1
    fi
  fi

  local steps=(
    set_homebrew
    set_apps
    set_store_apps
    set_dotfiles
    set_git
    set_node
    set_nvim
    set_pi
    set_ai
    set_ssh
    set_mac_cleanup
    set_mac_defaults
    set_network_shares
    set_nowplaying_binary
    set_crontab
  )

  local total=${#steps[@]}
  local current=0

  for step in "${steps[@]}"; do
    ((current++)) || true
    echo -e "\n${CYAN}[${current}/${total}]${RESET}"
    run_step "$step"
  done

  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${GREEN}║   ✓  Setup complete!                 ║${RESET}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  ${YELLOW}Next steps:${RESET}"
  echo -e "  1. Paste SSH keys above into ${BLUE}github.com/settings/keys${RESET}"
  echo -e "  2. Set ${BLUE}ANTHROPIC_API_KEY${RESET} (and others) manually"
  echo -e "  3. Sign in to App Store if you skipped it"
  echo -e "  4. Open terrorCastle share — enter SMB credentials once"
  echo ""
  echo -e "  Log: ${BLUE}~/setup.log${RESET}"
  echo ""
  log "Setup complete"
}

main "$@"
