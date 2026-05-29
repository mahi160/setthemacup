#!/usr/bin/env bash
# 12-mac-defaults.sh — Dock, Finder, keyboard, trackpad, screenshots, menu bar, misc.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_mac_defaults() {
  (set -euo pipefail
  step "Mac Defaults"

  # ── Dock ────────────────────────────────────────────────────────────────────
  defaults write com.apple.dock autohide                  -bool  true
  defaults write com.apple.dock autohide-delay            -float 0
  defaults write com.apple.dock autohide-time-modifier    -int   0
  defaults write com.apple.dock show-recents              -bool  false
  defaults write com.apple.dock static-only               -bool  true
  defaults write com.apple.dock expose-group-apps         -bool  true
  defaults write com.apple.dock tilesize                  -int   42
  defaults write com.apple.dock mru-spaces                -bool  false
  defaults write com.apple.dock show-process-indicators   -bool  false  # no dots under running apps
  defaults write com.apple.dock showhidden                -bool  false  # don't dim hidden apps
  defaults write com.apple.dock magnification             -bool  true
  defaults write com.apple.dock largesize                 -int   54
  defaults write com.apple.dock minimize-to-application  -bool  true   # minimise into app icon
  defaults write com.apple.dock mineffect                 -string scale # faster than genie
  killall Dock 2>/dev/null || true
  success "Dock configured."

  # ── Finder ──────────────────────────────────────────────────────────────────
  defaults write com.apple.finder FXPreferredViewStyle             -string "icnv"
  defaults write com.apple.finder ShowPathbar                      -bool   true
  defaults write com.apple.finder ShowStatusBar                    -bool   true
  defaults write NSGlobalDomain   AppleShowAllExtensions           -bool   true
  defaults write com.apple.finder AppleShowAllFiles                -bool   true
  defaults write com.apple.finder NewWindowTarget                  -string "PfHm"
  defaults write com.apple.finder FXDefaultSearchScope             -string "SCcf"
  defaults write com.apple.finder FXEnableExtensionChangeWarning   -bool   false
  defaults write NSGlobalDomain   NSNavPanelExpandedStateForSaveMode  -bool true
  defaults write NSGlobalDomain   NSNavPanelExpandedStateForSaveMode2 -bool true
  defaults write NSGlobalDomain   PMPrintingExpandedStateForPrint    -bool true
  defaults write NSGlobalDomain   PMPrintingExpandedStateForPrint2   -bool true
  defaults write com.apple.desktopservices DSDontWriteNetworkStores  -bool true
  defaults write com.apple.desktopservices DSDontWriteUSBStores      -bool true
  defaults write com.apple.print.PrintingPrefs "Quit When Finished"  -bool true


  defaults write com.apple.finder ShowRecentTags                      -bool false
  defaults write com.apple.finder SidebarTagsSctionDisclosedState     -bool false
  defaults write com.apple.finder SidebarShowingiCloudDesktop         -bool false
  defaults write com.apple.finder SidebarShowingSignedIntoiCloud      -bool false
  defaults write com.apple.finder SidebarSharedSectionDisclosedState  -bool false
  defaults write com.apple.finder SidebarDevicesSectionDisclosedState -bool true
  defaults write com.apple.finder SidebarPlacesSectionDisclosedState  -bool true
  killall Finder 2>/dev/null || true
  success "Finder configured."

  # ── Keyboard ────────────────────────────────────────────────────────────────
  defaults write NSGlobalDomain ApplePressAndHoldEnabled              -bool  false
  defaults write NSGlobalDomain InitialKeyRepeat                      -int   25
  defaults write NSGlobalDomain KeyRepeat                             -int   2
  defaults write NSGlobalDomain AppleKeyboardUIMode                   -int   2
  defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled  -bool  false
  defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled      -bool  false
  defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled    -bool  false
  defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled  -bool  false
  defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled   -bool  false
  success "Keyboard configured."

  # ── Trackpad ────────────────────────────────────────────────────────────────
  defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking             -bool  true
  defaults write com.apple.AppleMultitouchTrackpad                   Clicking             -bool  true
  defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior                 -int   1
  defaults write NSGlobalDomain             com.apple.mouse.tapBehavior                  -int   1
  defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad TrackpadThreeFingerDrag    -bool false
  defaults write com.apple.AppleMultitouchTrackpad                   TrackpadThreeFingerDrag    -bool false
  defaults -currentHost write -g com.apple.trackpad.threeFingerDragGesture                     -bool false 2>/dev/null || true
  # Accessibility > Pointer Control > Trackpad Options: drag without lock
  defaults write com.apple.AppleMultitouchTrackpad                   Dragging                   -bool true
  defaults write com.apple.AppleMultitouchTrackpad                   DragLock                   -bool false
  defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Dragging                   -bool true
  defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad DragLock                   -bool false
  defaults write com.apple.universalaccess.trackpadOptions           Dragging                   -bool true
  defaults write com.apple.universalaccess.trackpadOptions           DragLock                   -bool false
  defaults write com.apple.universalaccess.trackpadOptions           TrackpadScroll             -bool true
  defaults write com.apple.universalaccess.trackpadOptions           InertiaScroll              -bool true
  defaults write com.apple.AppleMultitouchTrackpad                   TrackpadScroll             -bool true
  defaults write com.apple.AppleMultitouchTrackpad                   TrackpadRightClick         -bool true
  defaults write com.apple.AppleMultitouchTrackpad                   TrackpadPinch              -bool true
  defaults write com.apple.AppleMultitouchTrackpad                   TrackpadTwoFingerDoubleTapGesture -int 1
  defaults write NSGlobalDomain com.apple.trackpad.scaling  -float 2
  defaults write NSGlobalDomain com.apple.trackpad.forceClick -bool true
  defaults write NSGlobalDomain com.apple.swipescrolldirection        -bool  false
  defaults write NSGlobalDomain AppleEnableSwipeNavigateWithScrolls   -bool  false
  success "Trackpad configured."

  # ── Screenshots ─────────────────────────────────────────────────────────────
  defaults write com.apple.screencapture location        -string "$HOME/Downloads"
  defaults write com.apple.screencapture type            -string "png"
  defaults write com.apple.screencapture disable-shadow  -bool   true
  success "Screenshots configured."

  # ── Menu bar ────────────────────────────────────────────────────────────────
  defaults write NSGlobalDomain           _HIHideMenuBar    -bool   false
  defaults write com.apple.menuextra.battery ShowPercent    -bool   true
  defaults write com.apple.menuextra.clock   DateFormat     -string "EEE d MMM  HH:mm"
  success "Menu bar configured."

  # ── Animations (performance) ──────────────────────────────────────────────────
  defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool  false
  defaults write NSGlobalDomain NSWindowResizeTime                  -float 0.001
  defaults write NSGlobalDomain QLPanelAnimationDuration            -float 0
  defaults write com.apple.finder DisableAllAnimations              -bool  true
  defaults write com.apple.dock   launchanim                        -bool  false
  defaults write com.apple.dock   expose-animation-duration         -float 0.1
  defaults write com.apple.Accessibility   ReduceMotionEnabled      -bool  true
  defaults write com.apple.Accessibility   ReduceTransparencyEnabled -bool  true
  success "Animations reduced."

  # ── Spotlight ──────────────────────────────────────────────────────────────
  # Disable Cmd+Space for Spotlight — Raycast will claim it on first launch
  /usr/libexec/PlistBuddy \
    -c "Set :AppleSymbolicHotKeys:64:enabled false" \
    "$HOME/Library/Preferences/com.apple.symbolichotkeys.plist" 2>/dev/null || true
  success "Spotlight Cmd+Space disabled — Raycast will take over on first launch."

  # ── Desktop names (Work / Personal / Media) ───────────────────────────────
  python3 - <<'PYEOF'
import subprocess, plistlib
raw = subprocess.check_output(['defaults', 'export', 'com.apple.spaces', '-'])
data = plistlib.loads(raw)
props = data['SpacesDisplayConfiguration'].get('Space Properties', [])
for i, name in enumerate(['Work', 'Personal', 'Media']):
    if i < len(props):
        props[i]['name'] = name
subprocess.run(['defaults', 'import', 'com.apple.spaces', '-'],
               input=plistlib.dumps(data), check=True)
PYEOF
  success "Desktop spaces named: Work, Personal, Media."

  # ── Handoff ────────────────────────────────────────────────────────────────
  defaults write com.apple.coreservices.useractivityd ActivityReceivingAllowed  -bool false
  defaults write com.apple.coreservices.useractivityd ActivityAdvertisingAllowed -bool false
  success "Handoff disabled."

  # ── Spaces ────────────────────────────────────────────────────────────────
  defaults write com.apple.spaces spans-displays -bool false
  killall SystemUIServer 2>/dev/null || true

  # ── Window behaviour ────────────────────────────────────────────────────────
  defaults write NSGlobalDomain          NSCloseAlwaysConfirmsChanges  -bool true
  defaults write NSGlobalDomain          NSDisableAutomaticTermination -bool true
  defaults write com.apple.systempreferences NSQuitAlwaysKeepsWindows  -bool false

  # ── Disk images ─────────────────────────────────────────────────────────────
  defaults write com.apple.frameworks.diskimages skip-verify         -bool true
  defaults write com.apple.frameworks.diskimages skip-verify-locked  -bool true
  defaults write com.apple.frameworks.diskimages skip-verify-remote  -bool true
  defaults write com.apple.frameworks.diskimages auto-open-ro-root   -bool true
  defaults write com.apple.frameworks.diskimages auto-open-rw-root   -bool true

  # ── Caps Lock → Left Control (hidutil LaunchAgent — no Karabiner needed) ──────
  local agent_plist="$HOME/Library/LaunchAgents/com.mahi.hidutil.caps-to-control.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat >"$agent_plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.mahi.hidutil.caps-to-control</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/hidutil</string>
    <string>property</string>
    <string>--set</string>
    <string>{"UserKeyMapping":[{"HIDKeyboardModifierMappingSrc":0x700000039,"HIDKeyboardModifierMappingDst":0x7000000E0}]}</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict></plist>
PLIST
  launchctl unload "$agent_plist" 2>/dev/null || true
  sleep 0.2
  launchctl load   "$agent_plist"
  /usr/bin/hidutil property --set '{"UserKeyMapping":[{"HIDKeyboardModifierMappingSrc":0x700000039,"HIDKeyboardModifierMappingDst":0x7000000E0}]}' 2>/dev/null || true
  success "Caps Lock → Control (active now + persists via LaunchAgent)."

  # ── Misc ────────────────────────────────────────────────────────────────────
  sudo nvram StartupMute=%01 2>/dev/null || true
  # Gatekeeper quarantine dialog left enabled (security default).
  # Uncomment to suppress it:
  # defaults write com.apple.LaunchServices LSQuarantine -bool false

  success "macOS defaults applied."; log "macOS defaults applied"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_mac_defaults; }
