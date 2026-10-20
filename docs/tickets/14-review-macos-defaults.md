# Review: macOS defaults

- **Status:** done
- **Owner:** human
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)

Go through every setting in `11-mac-cleanup.sh` and `12-mac-defaults.sh`: Dock, Finder, keyboard, trackpad, screenshots, menu bar, animations, Spotlight, Handoff, Spaces, window behaviour, disk images, Caps Lock → Control, startup chime, hot corners, Siri, Game Center, analytics, and removing empty Public/Sites folders.

## Output
Keep, drop or change each setting. The final list becomes `installer/data/defaults.ts`.

## Research findings (2026-10-20, macOS 27.2 "Golden Gate")
Key names were checked against the 27.2 system binaries.

### Fix
- **Reduce Motion isn't actually on** (`ReduceMotionEnabled` reads 0). Use `com.apple.universalaccess reduceMotion` / `reduceTransparency` (the terminal needs Full Disk Access), or verify in System Settings.
- **Drop `expose-animation-duration`:** the key no longer exists in Dock.
- **Spotlight hotkey comment:** it says Raycast takes over Cmd+Space. That's now Tinycast. Spotlight's clipboard history (⌘4) then needs a different hotkey.

### Candidates to add
- **Window manager** (`com.apple.WindowManager`):
  - `EnableStandardClickToShowDesktop false`: clicking the wallpaper no longer shoves all windows aside.
  - `GloballyEnabled false`: Stage Manager off.
  - `StandardHideWidgets true` and `StageManagerHideWidgets true`: no desktop widgets.
  - `EnableTiledWindowMargins false`: gapless tiling.
  - `AppWindowGroupingBehavior true`.
- **Dock:** `enterMissionControlByTopWindowDrag false` and `workspaces-auto-swoosh false`.
- **Global:** `NSGlobalDomain AppleReduceDesktopTinting true` and `NSDocumentSaveNewDocumentsToCloud false`.
- **Finder:** `_FXSortFoldersFirst`, `_FXSortFoldersFirstOnDesktop`, `FXRemoveOldTrashItems`, `WarnOnEmptyTrash false`, `ShowExternalHardDrivesOnDesktop false`, `ShowRemovableMediaOnDesktop false`, `ShowMountedServersOnDesktop false`.
- **Screenshots:** `screencapture show-thumbnail false` (saves instantly, no floating preview).
- **Menu bar spacing:** `-currentHost -g NSStatusItemSpacing 6` and `NSStatusItemSelectionPadding 6` (needs a logout).
- **Misc:** `ImageCapture disableHotPlug true` and `TimeMachine DoNotOfferNewDisksForBackup true`.

### Manual, with no defaults key (checklist printed at the end of the run)
- Liquid Glass slider set to the most opaque option (Appearance).
- Apple Intelligence off if unused (frees several GB). Notification summaries off.
- Menu Bar pane: untick system items you don't need.
- Spotlight categories and Search Privacy (exclude code folders).
- Login Items & Extensions cleanup (`sudo sfltool dumpbtm` to audit).

### Don't
- Disable SIP, use `purge` or cleaner apps, change `pmset` hibernation, turn off Spotlight indexing entirely, or set `LSQuarantine false`.

### Maintenance (candidate launchd job for ticket 12)
`brew upgrade && brew autoremove && brew cleanup --prune=all -s`, `pnpm store prune`, `docker system prune` (OrbStack).

## Resolution
Done. Broken keys dropped; recommended additions applied.
