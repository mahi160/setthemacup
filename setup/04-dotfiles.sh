#!/usr/bin/env bash
# 04-dotfiles.sh — Stow dotfiles, seed pi settings, fetch pokemon logo.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_dotfiles() {
  (set -euo pipefail
  step "Dotfiles"

  # Stow dotfiles
  # pi excluded — settings.json is managed by pi at runtime (written on every update).
  # macinstall copies it once as a seed; pi owns it after that.
  info "Stowing dotfiles from $DOTFILES_DIR..."
  local packages=(fastfetch git ghostty lazygit nvim starship stow tmux yazi zsh)
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

  # Restore Raycast 2 settings (encrypted DBs — account-tied, not device-tied)
  local rc_src="$SCRIPTS_DIR/raycast-data"
  local rc_dst="$HOME/Library/Application Support/com.raycast-x.macos"
  if [[ -d "$rc_src" ]] && ls "$rc_src"/*.db &>/dev/null 2>&1; then
    mkdir -p "$rc_dst"
    for db in "$rc_src"/*.db "$rc_src"/*.db-wal; do
      [[ -f "$db" ]] && cp "$db" "$rc_dst/$(basename "$db")"
    done
    success "Raycast settings restored."; log "Raycast settings restored"
  fi

  # Seed pi settings — copy (not symlink) so pi can write lastChangelogVersion freely
  local pi_settings_src="$DOTFILES_DIR/pi/.pi/agent/settings.json"
  local pi_settings_dst="$HOME/.pi/agent/settings.json"
  if [[ -f "$pi_settings_src" && ! -f "$pi_settings_dst" ]]; then
    mkdir -p "$(dirname "$pi_settings_dst")"
    cp "$pi_settings_src" "$pi_settings_dst"
    success "Pi settings seeded."; log "Pi settings seeded"
  else
    success "Pi settings already present — skipping seed."
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
