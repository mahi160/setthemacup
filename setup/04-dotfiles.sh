#!/usr/bin/env bash
# 04-dotfiles.sh — oh-my-zsh, zsh plugins, stow dotfiles, tmux plugins, pokemon logo.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_dotfiles() {
  (set -euo pipefail
  step "Dotfiles"

  # oh-my-zsh
  if [[ ! -d "$HOME/.oh-my-zsh" ]]; then
    info "Installing oh-my-zsh..."
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended || {
      error "oh-my-zsh installation failed."; log "oh-my-zsh installation failed"; return 1
    }
    success "oh-my-zsh installed."; log "oh-my-zsh installed"
  else
    success "oh-my-zsh already installed."
  fi

  # zsh plugins
  local zsh_custom="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"
  for plugin in "zsh-users/zsh-autosuggestions" "zsh-users/zsh-syntax-highlighting"; do
    local dest="$zsh_custom/plugins/${plugin##*/}"
    if [[ ! -d "$dest" ]]; then
      git clone "https://github.com/$plugin" "$dest" \
        || { warn "Failed to clone $plugin."; log "Failed to clone $plugin"; }
    else
      success "Plugin ${plugin##*/} already installed."
    fi
  done

  # Stow dotfiles
  info "Stowing dotfiles from $DOTFILES_DIR..."
  local packages=(fastfetch ghostty nvim pi starship stow tmux zsh)
  for pkg in "${packages[@]}"; do
    local conflicts
    conflicts=$(stow --dir="$DOTFILES_DIR" --target="$HOME" --simulate "$pkg" 2>&1 \
      | grep "existing target" | awk '{print $NF}' || true)

    # Use read loop to handle filenames with spaces correctly
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      local abs="$HOME/${f#"$HOME/"}"
      if [[ -e "$abs" && ! -L "$abs" ]]; then
        mv "$abs" "$abs.bak"; warn "Backed up $abs → $abs.bak"
      fi
    done <<< "$conflicts"

    stow --dir="$DOTFILES_DIR" --target="$HOME" "$pkg" \
      || { warn "Failed to stow $pkg."; log "Failed to stow $pkg"; }
    success "Stowed $pkg."
  done

  # tmux plugin manager
  local tpm_dir="$HOME/.config/tmux/plugins/tpm"
  if [[ ! -d "$tpm_dir" ]]; then
    info "Cloning TPM..."
    git clone --depth=1 https://github.com/tmux-plugins/tpm "$tpm_dir" \
      || { warn "TPM clone failed."; log "TPM clone failed"; }
  fi
  if [[ -f "$tpm_dir/bin/install_plugins" ]]; then
    info "Installing tmux plugins..."
    if "$tpm_dir/bin/install_plugins"; then
      success "tmux plugins installed."
    else
      warn "tmux plugin install failed."
    fi
  fi

  # Starter pokemon logo for fastfetch & nvim dashboard
  local pokemon_dir="$HOME/Pictures/pokemon_bg"
  mkdir -p "$pokemon_dir"
  if [[ ! -f "$pokemon_dir/current.png" ]]; then
    local starter_id=$(( RANDOM % 9 + 1 ))
    info "Fetching starter pokemon #${starter_id} for fastfetch logo..."
    if curl -sL --fail \
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${starter_id}.png" \
        -o "$pokemon_dir/${starter_id}.png" 2>/dev/null \
      && ln -sf "$pokemon_dir/${starter_id}.png" "$pokemon_dir/current.png"; then
      success "Pokemon logo ready."
    else
      warn "Pokemon fetch failed — fastfetch will show no logo on first run."
    fi
  fi

  log "Dotfiles setup complete"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_dotfiles; }
