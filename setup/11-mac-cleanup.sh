#!/usr/bin/env bash
# 11-mac-cleanup.sh — Clear Dock, disable Siri/Game Center/analytics, trim empty dirs.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_mac_cleanup() {
  (set -euo pipefail
  step "Mac Cleanup"

  # Dock
  defaults write com.apple.dock persistent-apps   -array
  defaults write com.apple.dock persistent-others -array
  killall Dock 2>/dev/null || true
  success "Dock cleared."

  # Siri
  defaults write com.apple.assistant.support "Assistant Enabled" -bool false
  defaults write com.apple.Siri StatusMenuVisible     -bool false
  defaults write com.apple.Siri UserHasDeclinedEnable -bool true
  success "Siri disabled."

  # Game Center
  defaults write com.apple.gamed Disabled -bool true
  success "Game Center disabled."

  # Spotlight — limit to useful categories only
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

  # Analytics & crash reporting
  defaults write com.apple.DiagnosticReportingSupport AutoSubmit -bool false
  defaults write com.apple.CrashReporter DialogType -string "none"
  defaults write com.apple.SubmitDiagInfo AutoSubmit -bool false 2>/dev/null || true
  success "Analytics & crash reporting disabled."

  # Remove empty default dirs
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

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_mac_cleanup; }
