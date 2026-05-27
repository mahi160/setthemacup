#!/bin/bash

set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")/../dotfiles" && pwd)"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
RESET='\033[0m'

info() { echo -e "${BLUE}==> $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn() { echo -e "${YELLOW}! $*${RESET}"; }
error() { echo -e "${RED}✗ $*${RESET}"; }

# ─── Logging ──────────────────────────────────────────────────────────────────
log_action() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$HOME/setup.log" 2>/dev/null || true
}

# ─── Homebrew ─────────────────────────────────────────────────────────────────
set_homebrew() {
  info "Setting up Homebrew..."
  if ! command -v brew >/dev/null 2>&1; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
      error "Homebrew installation failed."
      log_action "Homebrew installation failed"
      return 1
    }
    echo >>"$HOME/.zprofile"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >>"$HOME/.zprofile"
    eval "$(/opt/homebrew/bin/brew shellenv)"
    success "Homebrew installed."
    log_action "Homebrew installed"
  else
    success "Homebrew already installed."
  fi
}

# ─── Apps ─────────────────────────────────────────────────────────────────────
set_apps() {
  info "Updating Homebrew..."
  brew update || warn "brew update failed, continuing with cached index."

  info "Installing formulae..."

  local formulae=(
    # shell / terminal
    zsh eza bat coreutils fastfetch onefetch starship thefuck fzf mas

    # editors & dev tools
    neovim tmux lazygit lazysql stow
    git gh tree-sitter-cli
    # git-filter-repo  # rewrite git history — uncomment if needed
    # cobra-cli        # Go CLI scaffolding — uncomment if needed

    # search & file navigation
    ripgrep fd yazi

    # media
    ffmpeg
    # espeak-ng  # text-to-speech — uncomment if needed

    # languages & runtimes
    uv docker-compose

    # network & misc
    tailscale sheets
  )

  local casks=(
    # browsers
    brave-browser zen

    # terminal
    ghostty

    # editors & IDEs
    zed
    # raycast  # v2 not on brew — install manually from raycast.com

    # communication
    slack whatsapp telegram

    # productivity & utilities
    rectangle alt-tab caffeine mos
    doll stats localsend shottr obsidian

    # media & entertainment
    iina jellyfin-media-player calibre qbittorrent

    # design
    affinity

    # dev tools
    orbstack ollama

    # flashing
    balenaetcher

    # fonts
    font-jetbrains-mono-nerd-font # primary coding font
    font-monaspice-nerd-font      # includes Monaspace Radon (cursive italics)
  )

  for pkg in "${formulae[@]}"; do
    if brew list --formula "$pkg" &>/dev/null; then
      success "$pkg already installed."
    else
      info "Installing $pkg..."
      brew install "$pkg" || {
        warn "Failed to install formula: $pkg"
        log_action "Failed: $pkg"
      }
    fi
  done

  for pkg in "${casks[@]}"; do
    if brew list --cask "$pkg" &>/dev/null; then
      success "$pkg already installed."
    else
      info "Installing cask: $pkg..."
      brew install --cask "$pkg" || {
        warn "Failed to install cask: $pkg"
        log_action "Failed cask: $pkg"
      }
    fi
  done

  # pokemon-colorscripts — used by the Neovim dashboard
  # Installed from GitLab source (no stable brew tap on Apple Silicon)
  if ! command -v pokemon-colorscripts >/dev/null 2>&1; then
    info "Installing pokemon-colorscripts..."
    local tmp_dir
    tmp_dir="$(mktemp -d)"
    git clone --depth=1 https://gitlab.com/phoneybadger/pokemon-colorscripts.git "$tmp_dir" 2>/dev/null && (
      cd "$tmp_dir"
      sudo ./install.sh
    ) && success "pokemon-colorscripts installed." ||
      warn "pokemon-colorscripts install failed — Neovim dashboard will show an error."
    rm -rf "$tmp_dir"
  else
    success "pokemon-colorscripts already installed."
  fi

  log_action "Apps installation complete"
}

# ─── Dotfiles ─────────────────────────────────────────────────────────────────
set_dotfiles() {
  info "Setting up dotfiles and Zsh..."

  # oh-my-zsh
  if [[ ! -d "$HOME/.oh-my-zsh" ]]; then
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended || {
      error "oh-my-zsh installation failed."
      log_action "oh-my-zsh installation failed"
      return 1
    }
    success "oh-my-zsh installed."
  else
    success "oh-my-zsh already installed."
  fi

  # set zsh as default shell
  if [[ "$(dscl . -read "/Users/$USER" UserShell | awk '{print $2}')" != "$(which zsh)" ]]; then
    chsh -s "$(which zsh)" "$USER" || {
      error "Failed to set zsh as default shell."
      log_action "Failed to set zsh as default shell"
      return 1
    }
    success "zsh set as default shell."
  else
    success "zsh already default shell."
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
        log_action "Failed to clone $plugin"
      }
    else
      success "Plugin ${plugin##*/} already installed."
    fi
  done

  # stow dotfiles
  info "Stowing dotfiles from $DOTFILES_DIR..."
  # yazi omitted — dotfiles/yazi/ has no config yet; add when yazi is configured
  local packages=(fastfetch ghostty nvim pi starship stow tmux zsh)
  for pkg in "${packages[@]}"; do
    # backup any conflicting files before stowing
    local conflicts
    conflicts=$(
      stow --dir="$DOTFILES_DIR" --target="$HOME" --simulate "$pkg" 2>&1 |
        grep "existing target" |
        awk '{print $NF}' ||
        true
    )
    for f in $conflicts; do
      if [[ -e "$HOME/$f" ]]; then
        mv "$HOME/$f" "$HOME/$f.bak"
        warn "Backed up ~/$f → ~/$f.bak"
      fi
    done

    stow --dir="$DOTFILES_DIR" --target="$HOME" "$pkg" || {
      warn "Failed to stow $pkg."
      log_action "Failed to stow $pkg"
    }
    success "Stowed $pkg."
  done

  # Bootstrap TPM (plugins/ is gitignored so tpm is never stowed)
  local tpm_dir="$HOME/.config/tmux/plugins/tpm"
  if [[ ! -d "$tpm_dir" ]]; then
    info "Cloning TPM..."
    git clone --depth=1 https://github.com/tmux-plugins/tpm "$tpm_dir" || {
      warn "TPM clone failed — tmux plugins will not be installed."
      log_action "TPM clone failed"
    }
  fi

  # Install all plugins listed in tmux.conf
  local tpm_install="$tpm_dir/bin/install_plugins"
  if [[ -f "$tpm_install" ]]; then
    info "Installing tmux plugins..."
    "$tpm_install" && success "tmux plugins installed." || warn "tmux plugin install failed."
  fi

  log_action "Dotfiles setup complete"
}

# ─── Runtimes (bun, rust) ───────────────────────────────────────────────────────────────────
set_runtimes() {
  info "Setting up additional runtimes..."

  # bun — JS runtime/bundler; .zshrc expects the binary at ~/.bun/bin/bun
  if ! command -v bun >/dev/null 2>&1; then
    info "Installing bun..."
    curl -fsSL https://bun.sh/install | bash || {
      warn "bun installation failed."
      log_action "bun installation failed"
    }
    success "bun installed."
  else
    success "bun $(bun --version) already installed."
  fi

  # rust / cargo — .zshenv sources ~/.cargo/env
  if ! command -v cargo >/dev/null 2>&1; then
    info "Installing rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path || {
      warn "rustup installation failed."
      log_action "rustup installation failed"
    }
    # shellcheck disable=SC1091
    [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
    success "rust installed."
  else
    success "cargo $(cargo --version) already installed."
  fi

  log_action "Runtimes setup complete"
}

# ─── Git ─────────────────────────────────────────────────────────────────────
set_git() {
  info "Configuring git..."

  git config --global user.name "mahi160"
  git config --global user.email "omarsifat288@gmail.com"
  git config --global core.editor "nvim"
  git config --global init.defaultBranch "main"

  success "Git configured (personal identity as global)."
  log_action "Git configured"
}

# ─── Node ─────────────────────────────────────────────────────────────────────
set_node() {
  info "Setting up Node via fnm..."

  if ! command -v fnm >/dev/null 2>&1; then
    brew install fnm || {
      error "Failed to install fnm."
      log_action "Failed to install fnm"
      return 1
    }
  fi

  eval "$(fnm env --use-on-cd --shell zsh)"

  fnm install --lts || {
    error "Failed to install LTS Node."
    log_action "Failed to install LTS Node"
    return 1
  }

  fnm use lts-latest
  fnm alias default lts-latest
  success "Node $(node -v) active."

  # pnpm
  if ! command -v pnpm >/dev/null 2>&1; then
    npm install -g pnpm || {
      error "Failed to install pnpm."
      log_action "Failed to install pnpm"
      return 1
    }
    success "pnpm installed."
  else
    success "pnpm already installed."
  fi

  log_action "Node setup complete"
}

# ─── Neovim Bootstrap ──────────────────────────────────────────────────────────────────
set_nvim() {
  info "Bootstrapping Neovim plugins..."

  if ! command -v nvim >/dev/null 2>&1; then
    error "nvim not found — ensure set_apps ran successfully."
    return 1
  fi

  # Sync all lazy.nvim plugins (installs everything in lazy-lock.json)
  # This also triggers Mason to auto-install configured LSP servers
  info "Syncing plugins (this takes a few minutes on first run)..."
  nvim --headless "+Lazy! sync" +qa 2>/dev/null &&
    success "Neovim plugins synced." ||
    warn "Plugin sync had warnings — check :Lazy on first launch."

  # Remove disabled plugins from disk (e.g. markdown-preview.nvim, enabled=false)
  nvim --headless "+Lazy! clean" +qa 2>/dev/null &&
    success "Disabled plugins cleaned from disk." ||
    warn "Lazy clean had warnings."

  # Note: typescript-language-server is intentionally absent from lazyvim.json
  # (vtsls handles TS). Mason will never install it on a fresh setup.
  # On a migration from an older config, run manually: :MasonUninstall typescript-language-server

  log_action "Neovim bootstrap complete"
}

# ─── Pi ──────────────────────────────────────────────────────────────────────────────────
set_pi() {
  info "Installing pi (coding agent)..."

  if ! command -v pnpm >/dev/null 2>&1; then
    error "pnpm not found. Run set_node first."
    return 1
  fi

  pnpm add -g @earendil-works/pi-coding-agent || {
    error "Failed to install pi."
    log_action "Failed to install pi"
    return 1
  }

  success "pi installed."

  # Install pi extension dependencies
  # The claude extension uses @mariozechner/jiti (TypeScript runtime) which is gitignored
  local claude_ext="$HOME/.pi/agent/extensions/claude"
  if [[ -f "$claude_ext/package.json" ]]; then
    info "Installing pi claude extension dependencies..."
    (cd "$claude_ext" && pnpm install --frozen-lockfile 2>/dev/null) \
      && success "pi claude extension dependencies installed." \
      || warn "pi claude extension pnpm install failed — extension may not load."
  fi

  log_action "pi installed"
}

# ─── SSH ──────────────────────────────────────────────────────────────────────
set_ssh() {
  info "Setting up SSH..."

  mkdir -p "$HOME/.ssh" || {
    error "Failed to create ~/.ssh directory."
    log_action "Failed to create ~/.ssh"
    return 1
  }
  chmod 700 "$HOME/.ssh"

  local ssh_keys=(
    "id_ed25519:omarsifat288@gmail.com"
    "qp_ed25519:salauddin.sifat@questionpro.com"
  )

  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename comment <<<"$key"
    if [[ ! -f "$HOME/.ssh/$filename" ]]; then
      ssh-keygen -t ed25519 -C "$comment" -f "$HOME/.ssh/$filename" || {
        warn "Failed to generate SSH key $filename."
        log_action "Failed to generate SSH key $filename"
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

  chmod 600 "$HOME/.ssh/config" || {
    error "Failed to set permissions on ~/.ssh/config."
    log_action "Failed to set permissions on ~/.ssh/config"
    return 1
  }

  # add keys to agent (macOS keychain)
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
  log_action "SSH setup complete"
}

# ─── Store & Direct Apps ──────────────────────────────────────────────────────────
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
  info "Installing App Store apps via mas..."

  # requires being signed in to App Store
  if ! mas account &>/dev/null; then
    warn "Not signed in to App Store — skipping mas installs. Sign in via App Store app first."
    return 0
  fi

  local store_apps=(
    "682658836:GarageBand"
    "408981434:iMovie"
    "409183694:Keynote"
    "409203825:Numbers"
    "409201541:Pages"
  )

  for entry in "${store_apps[@]}"; do
    IFS=':' read -r id name <<<"$entry"
    if mas list | grep -q "^$id"; then
      success "$name already installed."
    else
      info "Installing $name..."
      mas install "$id" || warn "Failed to install $name."
    fi
  done

  info "Installing direct download apps..."

  install_dmg "Raycast" "https://www.raycast.com/download"
  install_dmg "FortiClient" "https://links.fortinet.com/forticlient/mac/vpnagent"

  log_action "Store & direct apps complete"
}

# ─── Mac Cleanup ─────────────────────────────────────────────────────────────
set_mac_cleanup() {
  info "Cleaning up macOS..."

  # reset dock to empty (your apps only, no Apple defaults)
  defaults write com.apple.dock persistent-apps -array
  defaults write com.apple.dock persistent-others -array
  killall Dock
  success "Dock cleared."

  # disable Siri
  defaults write com.apple.assistant.support "Assistant Enabled" -bool false
  defaults write com.apple.Siri StatusMenuVisible -bool false
  defaults write com.apple.Siri UserHasDeclinedEnable -bool true
  success "Siri disabled."

  # disable Game Center
  defaults write com.apple.gamed Disabled -bool true
  success "Game Center disabled."

  # disable Spotlight suggestions & telemetry
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

  # disable analytics & diagnostics
  defaults write com.apple.DiagnosticReportingSupport AutoSubmit -bool false
  defaults write com.apple.CrashReporter DialogType -string "none"
  defaults write com.apple.SubmitDiagInfo AutoSubmit -bool false 2>/dev/null || true
  success "Analytics & crash reporting disabled."

  # disable iCloud sign-in nag
  defaults write com.apple.systempreferences TMShowUnsupportedNetworkVolumes -bool false
  success "iCloud nudges disabled."

  # remove default junk directories if empty
  for dir in "$HOME/Public" "$HOME/Sites"; do
    if [[ -d "$dir" && -z "$(ls -A "$dir")" ]]; then
      rmdir "$dir"
      success "Removed empty $dir."
    elif [[ -d "$dir" ]]; then
      warn "$dir not empty, skipping."
    fi
  done

  log_action "Mac cleanup complete"
}

# ─── Mac Defaults ─────────────────────────────────────────────────────────────
set_mac_defaults() {
  info "Applying macOS defaults..."

  # Dock
  defaults write com.apple.dock autohide -bool true
  defaults write com.apple.dock autohide-delay -float 0
  defaults write com.apple.dock autohide-time-modifier -int 0
  defaults write com.apple.dock show-recents -bool false
  defaults write com.apple.dock static-only -bool true
  defaults write com.apple.dock expose-group-apps -bool true
  defaults write com.apple.dock tilesize -int 42
  killall Dock

  # Finder
  defaults write com.apple.finder FXPreferredViewStyle -string "icnv"
  defaults write com.apple.finder ShowPathbar -bool true
  defaults write com.apple.finder ShowStatusBar -bool true
  defaults write NSGlobalDomain AppleShowAllExtensions -bool true
  defaults write com.apple.finder AppleShowAllFiles -bool true
  defaults write com.apple.finder NewWindowTarget -string "PfHm"
  defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"
  killall Finder

  # Keyboard
  defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false
  defaults write NSGlobalDomain InitialKeyRepeat -int 15
  defaults write NSGlobalDomain KeyRepeat -int 2
  defaults write NSGlobalDomain AppleKeyboardUIMode -int 2

  # Trackpad
  defaults write NSGlobalDomain com.apple.trackpad.scaling -float 2
  defaults write NSGlobalDomain com.apple.trackpad.forceClick -bool true
  defaults write NSGlobalDomain AppleEnableSwipeNavigateWithScrolls -bool false

  # Menu bar
  defaults write NSGlobalDomain _HIHideMenuBar -bool false

  # Spaces
  defaults write com.apple.spaces spans-displays -bool false
  killall SystemUIServer

  success "macOS defaults applied."
  log_action "macOS defaults applied"
}

# ─── Crontab ─────────────────────────────────────────────────────────────────────────────
set_crontab() {
  info "Installing maintenance cron jobs..."
  local script_dir
  script_dir="$(dirname "$(realpath "$0")")"
  bash "${script_dir}/crontab-setup.sh" &&
    success "Cron jobs installed." ||
    warn "Cron setup failed — run scripts/crontab-setup.sh manually."
  log_action "Crontab setup complete"
}

# ─── Nowplaying Binary ────────────────────────────────────────────────────────────────
set_nowplaying_binary() {
  info "Compiling tmux-nowplaying binary..."
  local script_dir
  script_dir="$(dirname "$(realpath "$0")")"
  if bash "${script_dir}/compile-nowplaying.sh"; then
    success "nowplaying binary compiled."
    log_action "nowplaying binary compiled"
  else
    warn "nowplaying binary compilation failed — will fall back to Swift interpreter."
    log_action "nowplaying binary compilation failed (non-fatal)"
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  echo -e "${BLUE}"
  echo "╔══════════════════════════════════════╗"
  echo "║         macOS Setup Script           ║"
  echo "╚══════════════════════════════════════╝"
  echo -e "${RESET}"

  local steps=(
    set_homebrew
    set_apps
    set_store_apps
    set_dotfiles
    set_git
    set_node
    set_runtimes
    set_nvim
    set_pi
    set_ssh
    set_mac_cleanup
    set_mac_defaults
    set_nowplaying_binary
    set_crontab
  )

  for step in "${steps[@]}"; do
    echo ""
    $step || {
      error "Step '$step' failed. Aborting setup."
      log_action "Aborted at step: $step"
      exit 1
    }
  done

  echo ""
  success "Setup complete! Restart your terminal."
  log_action "Setup complete"
}

main "$@"
