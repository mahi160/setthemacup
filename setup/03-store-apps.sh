#!/usr/bin/env bash
# 03-store-apps.sh — Install Mac App Store apps (via mas) and direct DMG downloads.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

# Mount a .dmg, copy the .app, then unmount.
_install_dmg() {
  local name="$1" url="$2"

  # Validate name before using it in paths
  validate_name "$name" || return 1

  if [[ -d "/Applications/${name}.app" ]]; then
    success "$name already installed."; return 0
  fi

  info "Downloading $name..."
  # Quote the template so mktemp handles spaces/globs safely
  local tmp; tmp="$(mktemp "/tmp/${name}.XXXXXX.dmg")"
  curl -L --progress-bar "$url" -o "$tmp" || {
    warn "Failed to download $name."; rm -f "$tmp"; return 1
  }

  # Parse lines containing /Volumes/ — avoids picking up device nodes or blank trailing lines
  local volume; volume="$(hdiutil attach "$tmp" -nobrowse 2>/dev/null | awk -F'\t' '/\/Volumes\//{print $NF}' | tail -1)"
  if [[ -z "$volume" ]]; then
    warn "Failed to mount DMG for $name."; rm -f "$tmp"; return 1
  fi

  local app; app="$(find "$volume" -maxdepth 1 -name '*.app' | head -1)"
  if [[ -n "$app" ]]; then
    cp -R "$app" /Applications/ && success "$name installed."
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
    warn "Not signed in to App Store — skipping mas installs."
  else
    local mas_list; mas_list="$(mas list 2>/dev/null)"
    while IFS=':' read -r id name; do
      [[ -z "$id" ]] && continue
      # Use awk for exact field match — avoids regex metachar injection
      if echo "$mas_list" | awk -v id="$id" '$1 == id { found=1 } END { exit !found }'; then
        success "$name already installed."
      else
        info "Installing $name..."; mas install "$id" || warn "Failed to install $name."
      fi
    done < <(apps_pairs mas id)
  fi

  info "Installing direct download apps..."
  while IFS='|' read -r name url; do
    [[ -z "$name" ]] && continue
    _install_dmg "$name" "$url" || true
  done < <(apps_dmg)

  log "Store & direct apps complete"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_store_apps; }
