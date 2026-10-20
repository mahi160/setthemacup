# Port macOS settings (defaults.ts + display)

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [01](01-runner-skeleton.md), [14](14-review-macos-defaults.md)

## What
- `installer/data/defaults.ts`: `{ group, domain, key, type, value, desc, currentHost? }`.
- `steps/macos.ts`: `check()` reads the current values and reports "N/M applied"; `run()` writes only the ones that differ, then restarts only the affected apps (Dock, Finder, SystemUIServer). Special cases (PlistBuddy hotkey, hidutil LaunchAgent, nvram, Dock clear, Spotlight list) as typed actions.
- Display: `set-display-resolution` picks the largest scaled HiDPI mode of the built-in display, with no hardcoded size.
- Delete `11-mac-cleanup.sh`, `12-mac-defaults.sh`, `16-display.sh`.

## Resolution
`steps/macos.ts` + `data/defaults.ts`. "Clear the Dock" was dropped: with `static-only` the Dock only shows running apps anyway, and clearing would wipe icons added later.
