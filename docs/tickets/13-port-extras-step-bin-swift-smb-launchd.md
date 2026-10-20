# Port Extras step (bin/, Swift, SMB, launchd)

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [01](01-runner-skeleton.md), [12](12-review-helper-scripts-smb-shares-scheduled-jobs.md)

## What
- Rename `scripts/` to `bin/` with names that have no extension. The step symlinks each into `~/.local/bin`. Update every reference (tmux.conf, zshrc, theme readers, docs).
- Compile the Swift binaries (`nowplaying-mediaremote`, `set-display-resolution`) when the source is newer.
- Pokemon background and pi notify icon (moved from dotfiles).
- SMB LaunchAgents from `installer/data/smb.ts`.
- `lib/launchd.ts` helper; pi-prune and fnm-clean become `StartCalendarInterval` agents. Remove the old crontab entries.
- Delete `13-network.sh`, `14-nowplaying.sh`, `15-crontab.sh`.

## Resolution
`steps/extras.ts`. The old crontab entries and `com.mahi.*` LaunchAgents are removed automatically.
