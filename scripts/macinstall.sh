#!/usr/bin/env bash
# macinstall.sh — Full macOS dev environment setup.
#
# Runs 15 steps in order. Safe to re-run — every step checks before acting.
#
# Usage:
#   bash scripts/macinstall.sh            # full run
#   bash scripts/macinstall.sh set_node   # single step

# ─── NOTE on subshells ────────────────────────────────────────────────────────
# Most steps run in a (subshell) for error isolation, BUT set_homebrew and
# set_node intentionally do NOT — they must export PATH changes to the outer
# shell so subsequent steps can find brew/node/pnpm.

DOTFILES_DIR="$(cd "$(dirname "$0")/../dotfiles" && pwd)"
APPS_JSON="$(cd "$(dirname "$0")" && pwd)/apps.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export SETTHEMACUP="$REPO_DIR"

RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'
BLUE='\033[34m'; CYAN='\033[36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}==> $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}! $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}"; }
step()    { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }

LOG_FILE="$HOME/setup.log"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$LOG_FILE" 2>/dev/null || true; }

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

bootstrap_env() {
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --use-on-cd --shell bash 2>/dev/null)" || true
  fi
  export PNPM_HOME="$HOME/Library/pnpm"
  case ":$PATH:" in
    *":$PNPM_HOME/bin:"*) ;;
    *) export PATH="$PNPM_HOME/bin:$PATH" ;;
  esac
  if command -v npm >/dev/null 2>&1; then
    local npm_bin
    npm_bin="$(npm config get prefix 2>/dev/null)/bin"
    case ":$PATH:" in
      *":$npm_bin:"*) ;;
      *) export PATH="$npm_bin:$PATH" ;;
    esac
  fi
}

# ─── 1. Homebrew — NOT in subshell (exports must reach outer shell) ────────────
set_homebrew() {
  step "Homebrew"
  if ! command -v brew >/dev/null 2>&1; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
      error "Homebrew installation failed."; log "Homebrew installation failed"; return 1
    }
    if ! grep -q 'brew shellenv' "$HOME/.zprofile" 2>/dev/null; then
      { echo; echo 'eval "$(/opt/homebrew/bin/brew shellenv)"'; } >>"$HOME/.zprofile"
    fi
    success "Homebrew installed."; log "Homebrew installed"
  else
    success "Homebrew already installed."
  fi
  bootstrap_env
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
  if [[ -d "/Applications/$name.app" ]]; then success "$name already installed."; return 0; fi
  info "Downloading $name..."
  local tmp; tmp="$(mktemp /tmp/$name.XXXXXX.dmg)"
  curl -L --progress-bar "$url" -o "$tmp" || { warn "Failed to download $name."; rm -f "$tmp"; return 1; }
  local volume; volume="$(hdiutil attach "$tmp" -nobrowse -quiet | awk 'END{print $NF}')"
  if [[ -z "$volume" ]]; then
    warn "Failed to mount DMG for $name."; rm -f "$tmp"; return 1
  fi
  local app; app="$(find "$volume" -maxdepth 1 -name '*.app' | head -1)"
  if [[ -n "$app" ]]; then cp -R "$app" /Applications/ && success "$name installed."
  else warn "No .app found in $name DMG."; fi
  hdiutil detach "$volume" -quiet 2>/dev/null || true
  rm -f "$tmp"
}

set_store_apps() {
  (set -euo pipefail
  step "Store & Direct Apps"
  if ! mas account &>/dev/null; then
    warn "Not signed in to App Store — skipping mas installs."
  else
    while IFS=':' read -r id name; do
      [[ -z "$id" ]] && continue
      if mas list | grep -q "^$id"; then success "$name already installed."
      else info "Installing $name..."; mas install "$id" || warn "Failed to install $name."; fi
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

  if [[ ! -d "$HOME/.oh-my-zsh" ]]; then
    info "Installing oh-my-zsh..."
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended || {
      error "oh-my-zsh installation failed."; log "oh-my-zsh installation failed"; return 1
    }
    success "oh-my-zsh installed."; log "oh-my-zsh installed"
  else
    success "oh-my-zsh already installed."
  fi

  local zsh_custom="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"
  for plugin in "zsh-users/zsh-autosuggestions" "zsh-users/zsh-syntax-highlighting"; do
    local dest="$zsh_custom/plugins/${plugin##*/}"
    if [[ ! -d "$dest" ]]; then
      git clone "https://github.com/$plugin" "$dest" || { warn "Failed to clone $plugin."; log "Failed to clone $plugin"; }
    else
      success "Plugin ${plugin##*/} already installed."
    fi
  done

  info "Stowing dotfiles from $DOTFILES_DIR..."
  local packages=(fastfetch ghostty nvim pi starship stow tmux zsh)
  for pkg in "${packages[@]}"; do
    local conflicts
    conflicts=$(stow --dir="$DOTFILES_DIR" --target="$HOME" --simulate "$pkg" 2>&1 | grep "existing target" | awk '{print $NF}' || true)
    for f in $conflicts; do
      local abs="$HOME/${f#$HOME/}"
      if [[ -e "$abs" && ! -L "$abs" ]]; then
        mv "$abs" "$abs.bak"; warn "Backed up $abs → $abs.bak"
      fi
    done
    stow --dir="$DOTFILES_DIR" --target="$HOME" "$pkg" || { warn "Failed to stow $pkg."; log "Failed to stow $pkg"; }
    success "Stowed $pkg."
  done

  local tpm_dir="$HOME/.config/tmux/plugins/tpm"
  if [[ ! -d "$tpm_dir" ]]; then
    info "Cloning TPM..."
    git clone --depth=1 https://github.com/tmux-plugins/tpm "$tpm_dir" || { warn "TPM clone failed."; log "TPM clone failed"; }
  fi
  if [[ -f "$tpm_dir/bin/install_plugins" ]]; then
    info "Installing tmux plugins..."
    "$tpm_dir/bin/install_plugins" && success "tmux plugins installed." || warn "tmux plugin install failed."
  fi

  # Ensure pokemon current.png exists for fastfetch & nvim dashboard
  local pokemon_dir="$HOME/Pictures/pokemon_bg"
  mkdir -p "$pokemon_dir"
  if [[ ! -f "$pokemon_dir/current.png" ]]; then
    local starter_id=$(( RANDOM % 9 + 1 ))
    info "Fetching starter pokemon #${starter_id} for fastfetch logo..."
    curl -sL --fail \
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${starter_id}.png" \
      -o "$pokemon_dir/${starter_id}.png" 2>/dev/null && \
      ln -sf "$pokemon_dir/${starter_id}.png" "$pokemon_dir/current.png" && \
      success "Pokemon logo ready." || warn "Pokemon fetch failed — fastfetch will show no logo on first run."
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
  success "Git configured."; log "Git configured"
  )
}

# ─── 6. Node — NOT in subshell (exports must reach outer shell) ────────────────
set_node() {
  step "Node"
  if ! command -v fnm >/dev/null 2>&1; then
    info "Installing fnm..."
    brew install fnm || { error "Failed to install fnm."; log "Failed to install fnm"; return 1; }
  fi
  eval "$(fnm env --use-on-cd --shell bash)"
  fnm install --lts || { error "Failed to install LTS Node."; log "Failed to install LTS Node"; return 1; }
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

# ─── 7. Neovim ────────────────────────────────────────────────────────────────
set_nvim() {
  (set -euo pipefail
  step "Neovim"
  if ! command -v nvim >/dev/null 2>&1; then error "nvim not found."; return 1; fi
  info "Syncing lazy.nvim plugins (first run may take a few minutes)..."
  nvim --headless "+Lazy! sync" +qa 2>/dev/null && success "Neovim plugins synced." || warn "Plugin sync had warnings — check :Lazy on first launch."
  nvim --headless "+Lazy! clean" +qa 2>/dev/null && success "Disabled plugins cleaned." || warn "Lazy clean had warnings."
  log "Neovim bootstrap complete"
  )
}

# ─── 8. Pi ────────────────────────────────────────────────────────────────────
set_pi() {
  (set -euo pipefail
  step "Pi"
  if ! command -v pnpm >/dev/null 2>&1; then error "pnpm not found — set_node may have failed."; return 1; fi
  info "Installing pi coding agent..."
  pnpm add -g @earendil-works/pi-coding-agent || { error "Failed to install pi."; log "Failed to install pi"; return 1; }
  success "pi installed."
  local claude_ext="$HOME/.pi/agent/extensions/claude"
  if [[ -f "$claude_ext/package.json" ]]; then
    info "Installing pi claude extension dependencies..."
    (cd "$claude_ext" && pnpm install --frozen-lockfile 2>/dev/null) && success "pi claude extension ready." || warn "pi claude extension install failed."
  fi
  log "pi installed"
  )
}

# ─── 9. AI Skills ─────────────────────────────────────────────────────────────
set_ai() {
  (set -euo pipefail
  step "AI Skills"
  if ! command -v npx >/dev/null 2>&1; then warn "npx not found — skipping AI skills."; return 0; fi
  while IFS='|' read -r source desc; do
    [[ -z "$source" ]] && continue
    info "  $source — $desc"
    npx --yes skills add "$source" 2>/dev/null && success "Installed: $source" || warn "Failed: $source  →  retry: npx skills add $source"
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
  mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"

  local ssh_keys=("id_ed25519:omarsifat288@gmail.com" "qp_ed25519:salauddin.sifat@questionpro.com")
  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename comment <<<"$key"
    if [[ ! -f "$HOME/.ssh/$filename" ]]; then
      ssh-keygen -t ed25519 -C "$comment" -f "$HOME/.ssh/$filename" -N "" || { warn "Failed to generate $filename."; log "Failed to generate SSH key $filename"; }
      success "Generated $filename."
    else
      success "SSH key $filename already exists."
    fi
  done

  # Merge host entries — never overwrite existing ones
  local config="$HOME/.ssh/config"; touch "$config"; chmod 600 "$config"
  if ! grep -q "Host github.com" "$config" 2>/dev/null; then
    cat >>"$config" <<'EOF'

Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
EOF
    success "Added github.com to SSH config."
  else
    success "github.com already in SSH config."
  fi
  if ! grep -q "Host qp.github.com" "$config" 2>/dev/null; then
    cat >>"$config" <<'EOF'

Host qp.github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/qp_ed25519
EOF
    success "Added qp.github.com to SSH config."
  else
    success "qp.github.com already in SSH config."
  fi

  eval "$(ssh-agent -s)" >/dev/null
  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename _ <<<"$key"
    if [[ -f "$HOME/.ssh/$filename" ]]; then
      ssh-add --apple-use-keychain "$HOME/.ssh/$filename" 2>/dev/null || ssh-add "$HOME/.ssh/$filename" 2>/dev/null || warn "Could not add $filename to agent."
    fi
  done

  echo ""
  info "Add these public keys to GitHub:"
  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename comment <<<"$key"
    if [[ -f "$HOME/.ssh/$filename.pub" ]]; then
      echo -e "  ${YELLOW}[$comment]${RESET}"; echo "  $(cat "$HOME/.ssh/$filename.pub")"; echo ""
    fi
  done
  success "SSH setup complete."; log "SSH setup complete"
  )
}

# ─── 11. Mac Cleanup ──────────────────────────────────────────────────────────
set_mac_cleanup() {
  (set -euo pipefail
  step "Mac Cleanup"
  defaults write com.apple.dock persistent-apps -array
  defaults write com.apple.dock persistent-others -array
  killall Dock 2>/dev/null || true; success "Dock cleared."
  defaults write com.apple.assistant.support "Assistant Enabled" -bool false
  defaults write com.apple.Siri StatusMenuVisible -bool false
  defaults write com.apple.Siri UserHasDeclinedEnable -bool true
  success "Siri disabled."
  defaults write com.apple.gamed Disabled -bool true; success "Game Center disabled."
  defaults write com.apple.spotlight orderedItems -array \
    '{"enabled"=1;"name"="APPLICATIONS";}' '{"enabled"=1;"name"="SYSTEM_PREFS";}' \
    '{"enabled"=1;"name"="DIRECTORIES";}' '{"enabled"=1;"name"="PDF";}' \
    '{"enabled"=1;"name"="FONTS";}' '{"enabled"=0;"name"="DOCUMENTS";}' \
    '{"enabled"=0;"name"="MESSAGES";}' '{"enabled"=0;"name"="CONTACT";}' \
    '{"enabled"=0;"name"="EVENT_TODO";}' '{"enabled"=0;"name"="IMAGES";}' \
    '{"enabled"=0;"name"="BOOKMARKS";}' '{"enabled"=0;"name"="MUSIC";}' \
    '{"enabled"=0;"name"="MOVIES";}' '{"enabled"=0;"name"="PRESENTATIONS";}' \
    '{"enabled"=0;"name"="SPREADSHEETS";}' '{"enabled"=0;"name"="SOURCE";}' \
    '{"enabled"=0;"name"="MENU_DEFINITION";}' '{"enabled"=0;"name"="MENU_OTHER";}' \
    '{"enabled"=0;"name"="MENU_CONVERSION";}' '{"enabled"=0;"name"="MENU_EXPRESSION";}' \
    '{"enabled"=0;"name"="MENU_WEBSEARCH";}' '{"enabled"=0;"name"="MENU_SPOTLIGHT_SUGGESTIONS";}'
  killall mds 2>/dev/null || true; success "Spotlight suggestions disabled."
  defaults write com.apple.DiagnosticReportingSupport AutoSubmit -bool false
  defaults write com.apple.CrashReporter DialogType -string "none"
  defaults write com.apple.SubmitDiagInfo AutoSubmit -bool false 2>/dev/null || true
  success "Analytics & crash reporting disabled."
  for dir in "$HOME/Public" "$HOME/Sites"; do
    if [[ -d "$dir" && -z "$(ls -A "$dir")" ]]; then rmdir "$dir" && success "Removed empty $dir."
    elif [[ -d "$dir" ]]; then warn "$dir not empty, skipping."; fi
  done
  log "Mac cleanup complete"
  )
}

# ─── 12. Mac Defaults ─────────────────────────────────────────────────────────
set_mac_defaults() {
  (set -euo pipefail
  step "Mac Defaults"

  # Dock
  defaults write com.apple.dock autohide -bool true
  defaults write com.apple.dock autohide-delay -float 0
  defaults write com.apple.dock autohide-time-modifier -int 0
  defaults write com.apple.dock show-recents -bool false
  defaults write com.apple.dock static-only -bool true
  defaults write com.apple.dock expose-group-apps -bool true
  defaults write com.apple.dock tilesize -int 42
  defaults write com.apple.dock mru-spaces -bool false
  killall Dock 2>/dev/null || true; success "Dock configured."

  # Finder
  defaults write com.apple.finder FXPreferredViewStyle -string "icnv"
  defaults write com.apple.finder ShowPathbar -bool true
  defaults write com.apple.finder ShowStatusBar -bool true
  defaults write NSGlobalDomain AppleShowAllExtensions -bool true
  defaults write com.apple.finder AppleShowAllFiles -bool true
  defaults write com.apple.finder NewWindowTarget -string "PfHm"
  defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"
  defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false
  defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true
  defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 -bool true
  defaults write NSGlobalDomain PMPrintingExpandedStateForPrint -bool true
  defaults write NSGlobalDomain PMPrintingExpandedStateForPrint2 -bool true
  defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
  defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true
  defaults write com.apple.print.PrintingPrefs "Quit When Finished" -bool true

  # Finder sidebar
  if command -v mysides >/dev/null 2>&1; then
    mysides list 2>/dev/null | awk -F' -> ' '{print $1}' | while read -r item; do
      [[ -n "$item" ]] && mysides remove "$item" 2>/dev/null || true
    done
    mysides add "Home"      "file://$HOME/"
    mysides add "Documents" "file://$HOME/Documents/"
    mysides add "Downloads" "file://$HOME/Downloads/"
    mysides add "Desktop"   "file://$HOME/Desktop/"
    success "Finder sidebar cleaned via mysides."
  else
    warn "mysides not installed — sidebar cleanup skipped."
  fi
  defaults write com.apple.finder ShowRecentTags -bool false
  defaults write com.apple.finder SidebarTagsSctionDisclosedState -bool false
  defaults write com.apple.finder SidebarShowingiCloudDesktop -bool false
  defaults write com.apple.finder SidebarShowingSignedIntoiCloud -bool false
  defaults write com.apple.finder SidebarSharedSectionDisclosedState -bool false
  defaults write com.apple.finder SidebarDevicesSectionDisclosedState -bool true
  defaults write com.apple.finder SidebarPlacesSectionDisclosedState -bool true
  killall Finder 2>/dev/null || true; success "Finder configured."

  # Keyboard
  defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false
  defaults write NSGlobalDomain InitialKeyRepeat -int 10
  defaults write NSGlobalDomain KeyRepeat -int 1
  defaults write NSGlobalDomain AppleKeyboardUIMode -int 2
  defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
  success "Keyboard configured."

  # Trackpad
  defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true
  defaults write com.apple.AppleMultitouchTrackpad Clicking -bool true
  defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior -int 1
  defaults write NSGlobalDomain com.apple.mouse.tapBehavior -int 1
  defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad TrackpadThreeFingerDrag -bool false
  defaults write com.apple.AppleMultitouchTrackpad TrackpadThreeFingerDrag -bool false
  defaults write com.apple.AppleMultitouchTrackpad DragLock -bool false
  defaults write com.apple.AppleMultitouchTrackpad Dragging -bool false
  defaults write com.apple.universalaccess.trackpadOptions TapToClickLockout -bool false
  defaults -currentHost write -g com.apple.trackpad.threeFingerDragGesture -bool true 2>/dev/null || true
  defaults write NSGlobalDomain com.apple.trackpad.scaling -float 2.5
  defaults write NSGlobalDomain com.apple.trackpad.forceClick -bool true
  defaults write NSGlobalDomain com.apple.swipescrolldirection -bool false
  defaults write NSGlobalDomain AppleEnableSwipeNavigateWithScrolls -bool false
  success "Trackpad configured."

  # Screenshots
  defaults write com.apple.screencapture location -string "$HOME/Downloads"
  defaults write com.apple.screencapture type -string "png"
  defaults write com.apple.screencapture disable-shadow -bool true
  success "Screenshots configured."

  # Menu bar
  defaults write NSGlobalDomain _HIHideMenuBar -bool false
  defaults write com.apple.menuextra.battery ShowPercent -bool true
  defaults write com.apple.menuextra.clock DateFormat -string "EEE d MMM  HH:mm"
  success "Menu bar configured."

  # Spaces
  defaults write com.apple.spaces spans-displays -bool false
  killall SystemUIServer 2>/dev/null || true

  # Window behaviour
  defaults write NSGlobalDomain NSCloseAlwaysConfirmsChanges -bool true
  defaults write NSGlobalDomain NSDisableAutomaticTermination -bool true
  defaults write com.apple.systempreferences NSQuitAlwaysKeepsWindows -bool false

  # Disk images
  defaults write com.apple.frameworks.diskimages skip-verify -bool true
  defaults write com.apple.frameworks.diskimages skip-verify-locked -bool true
  defaults write com.apple.frameworks.diskimages skip-verify-remote -bool true
  defaults write com.apple.frameworks.diskimages auto-open-ro-root -bool true
  defaults write com.apple.frameworks.diskimages auto-open-rw-root -bool true

  # Misc
  sudo nvram StartupMute=%01 2>/dev/null || true
  # Quarantine dialog disabled — comment out if you want the security prompt back:
  # defaults write com.apple.LaunchServices LSQuarantine -bool false

  success "macOS defaults applied."; log "macOS defaults applied"
  )
}

# ─── 13. Network Shares ───────────────────────────────────────────────────────
set_network_shares() {
  (set -euo pipefail
  step "Network Shares"
  mkdir -p "$HOME/Library/LaunchAgents"

  while IFS='|' read -r name url; do
    [[ -z "$name" ]] && continue
    local safe_name; safe_name="$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')"
    local label="com.mahi.mount.${safe_name}"
    local plist="$HOME/Library/LaunchAgents/${label}.plist"
    local mount_point="/Volumes/${name}"
    local host; host="$(echo "$url" | sed 's|smb://||' | cut -d'/' -f1)"

    sudo mkdir -p "$mount_point" 2>/dev/null || warn "Could not create $mount_point."

    local mount_script="$HOME/Library/LaunchAgents/${label}.sh"
    cat >"$mount_script" <<SCRIPT
#!/bin/bash
MOUNT_POINT="${mount_point}"
URL="${url}"
HOST="${host}"
LOG="/tmp/${name}-mount.log"
log() { echo "[\$(date '+%Y-%m-%d %H:%M:%S')] \$*" >> "\$LOG"; }
if mount | grep -q "\$MOUNT_POINT"; then log "Already mounted"; exit 0; fi
log "Waiting for \$HOST..."
for i in \$(seq 1 6); do
  ping -c1 -W2 "\$HOST" &>/dev/null && break
  log "  attempt \$i — waiting 5s..."; sleep 5
done
if ! ping -c1 -W2 "\$HOST" &>/dev/null; then log "Host unreachable — skipping."; exit 1; fi
log "Mounting \$URL → \$MOUNT_POINT"
/sbin/mount_smbfs -o nobrowse "\$URL" "\$MOUNT_POINT" >> "\$LOG" 2>&1 && log "Mounted." || {
  log "mount_smbfs failed — trying Finder..."
  /usr/bin/open "\$URL" >> "\$LOG" 2>&1 || log "Finder open also failed."
}
SCRIPT
    chmod +x "$mount_script"

    cat >"$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
    <key>Label</key><string>${label}</string>
    <key>ProgramArguments</key><array>
        <string>/bin/bash</string><string>${mount_script}</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>StandardOutPath</key><string>/tmp/${name}-mount.log</string>
    <key>StandardErrorPath</key><string>/tmp/${name}-mount.log</string>
</dict></plist>
PLIST

    launchctl unload "$plist" 2>/dev/null || true
    launchctl load "$plist"
    success "${name} — LaunchAgent registered."
    info "  Mount point : $mount_point"
    info "  Server      : $url"
    info "  Log         : /tmp/${name}-mount.log"
    echo ""
    warn "  Credentials: add once to Keychain Access — Kind: Network Password"
    warn "    Server: $host  Account: <username>  Password: <password>"
    echo ""
    log "Network share configured: $name → $url"
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
    success "nowplaying binary compiled."; log "nowplaying binary compiled"
  else
    warn "nowplaying binary compilation failed — tmux will fall back to Swift interpreter."
    log "nowplaying binary compilation failed (non-fatal)"
  fi
}

# ─── 15. Crontab ──────────────────────────────────────────────────────────────
set_crontab() {
  step "Crontab"
  bash "${SCRIPT_DIR}/crontab-setup.sh" && success "Cron jobs installed." || warn "Cron setup failed — run scripts/crontab-setup.sh manually."
  log "Crontab setup complete"
}

# ─── Step runner ──────────────────────────────────────────────────────────────
CRITICAL_STEPS=(set_homebrew set_apps set_dotfiles set_node)
is_critical() { local s="$1"; for c in "${CRITICAL_STEPS[@]}"; do [[ "$c" == "$s" ]] && return 0; done; return 1; }
run_step() {
  local fn="$1"
  if is_critical "$fn"; then
    $fn || { error "Critical step '$fn' failed — aborting."; log "Aborted at critical step: $fn"; exit 1; }
  else
    $fn || warn "Step '$fn' failed — continuing."
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
  bootstrap_env

  if [[ $# -gt 0 ]]; then
    if declare -f "$1" >/dev/null 2>&1; then
      info "Running single step: $1"; "$1"; exit $?
    else
      error "Unknown step: $1"
      echo "Available steps:"; declare -F | awk '{print "  "$3}' | grep "^  set_"
      exit 1
    fi
  fi

  local steps=(
    set_homebrew set_apps set_store_apps set_dotfiles set_git set_node
    set_nvim set_pi set_ai set_ssh set_mac_cleanup set_mac_defaults
    set_network_shares set_nowplaying_binary set_crontab
  )
  local total=${#steps[@]} current=0
  for s in "${steps[@]}"; do
    ((current++)) || true
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
  echo -e "  4. Open terrorCastle share — enter SMB credentials once"
  echo -e "  5. Run ${BLUE}pokemon-bg${RESET} to set your first Ghostty background"
  echo ""
  echo -e "  Log: ${BLUE}~/setup.log${RESET}"
  echo ""
  log "Setup complete"
}

main "$@"