#!/usr/bin/env bash
# 04-dotfiles.sh — Stow dotfiles, seed pi settings, fetch starter pokemon background.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_dotfiles() {
  (
    set -euo pipefail
    step "Dotfiles"

    # Stow dotfiles
    # pi excluded — settings.json is managed by pi at runtime (written on every update).
    # setup seeds it once via cp below; pi owns it after that.
    info "Stowing dotfiles from $DOTFILES_DIR..."
    local packages=(fastfetch pi git ghostty lazygit nvim starship stow tmux yazi zsh)
    for pkg in "${packages[@]}"; do
      local conflicts
      conflicts=$(stow --dir="$DOTFILES_DIR" --target="$HOME" --simulate "$pkg" 2>&1 |
        grep "existing target" | awk '{print $NF}' || true)

      # Use read loop to handle filenames with spaces correctly
      while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        local abs="$HOME/${f#"$HOME/"}"
        if [[ -e "$abs" && ! -L "$abs" ]]; then
          mv "$abs" "$abs.bak"
          warn "Backed up $abs → $abs.bak"
        fi
      done <<<"$conflicts"

      stow --dir="$DOTFILES_DIR" --target="$HOME" "$pkg" ||
        {
          warn "Failed to stow $pkg."
          log "Failed to stow $pkg"
        }
      success "Stowed $pkg."
    done

    # Fetch starter pokemon for Ghostty background (cached — only runs once)
    local pokemon_dir="$HOME/Pictures/pokemon_bg"
    mkdir -p "$pokemon_dir"
    if [[ ! -f "$pokemon_dir/current.png" ]]; then
      local starter_id=$((RANDOM % 9 + 1))
      info "Fetching starter pokemon #${starter_id} for Ghostty background..."
      if curl -sL --fail \
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${starter_id}.png" \
        -o "$pokemon_dir/${starter_id}.png" 2>/dev/null &&
        ln -sf "$pokemon_dir/${starter_id}.png" "$pokemon_dir/current.png"; then
        success "Pokemon background ready — Alt+Q to cycle."
      else
        warn "Pokemon fetch failed — run pokemon-bg manually after setup."
      fi
    fi

    # Generate pi agent notification icon (π on dark bg → ~/.local/share/pi/notify-icon.png)
    local icon_script="$SETUP_DIR/scripts/pi-notify-icon.sh"
    if [[ -f "$icon_script" && ! -f "$HOME/.local/share/pi/notify-icon.png" ]]; then
      info "Generating pi notification icon..."
      bash "$icon_script" && success "Pi notification icon ready." || warn "Pi icon generation failed — run scripts/pi-notify-icon.sh manually."
    fi

    log "Dotfiles setup complete"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && {
  source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
  set_dotfiles
}
