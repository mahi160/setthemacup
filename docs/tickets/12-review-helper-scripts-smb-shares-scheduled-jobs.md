# Review: helper scripts, SMB shares, scheduled jobs

- **Status:** done
- **Owner:** human
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)

## Scripts (`scripts/`)
check-pr, compile-nowplaying, crontab-setup, dev, note, nowplaying_mediaremote.swift, pi-notify-icon, pi-prune, pi-qna, pokemon-bg, quick-learn, quick-note, set-display-resolution.swift, tmux-battery, tmux-cpu, tmux-git, tmux-nowplaying, toggle-theme

Keep, remove or rename each one? `compile-nowplaying` and `crontab-setup` are probably replaced by the installer.

## Also decide
- SMB shares to auto-mount (currently one home server).
- Scheduled jobs: pi-prune (weekly) and fnm multishell cleanup (weekly). Any more?
- Keep the pokemon background and pi notify icon?

## Added from the apps review
- **`vpn` helper:** done as `scripts/vpn.sh` (alias `vpn`).
  - Pick a gateway with fzf, or pass one: `vpn pune`.
  - It runs `sudo openfortivpn <gw> --saml-login` and opens the SSO page.
  - Gateways (Pune, Seattle, Dallas, Europe, KSA; port 25433) live in `~/.config/vpn/gateways`, which is **untracked**, so company hostnames stay out of the repo.
  - To decide: should setup recreate that file (tracked template) or not?
- **DNS check:** openfortivpn writes `/etc/resolv.conf`, which GUI apps ignore. Check `scutil --dns` after connecting.
- **pokemon-bg:** it rewrites `background-image` in the tracked Ghostty config (hence the "rotate background image" commits). Point Ghostty at `~/Pictures/pokemon_bg/current.png` and only swap the symlink.
- **Maintenance job:** brew upgrade/autoremove/cleanup, `pnpm store prune`, OrbStack prune. `mo clean` is **not** scheduled; run it by hand.

## Resolution
Done. `scripts/` became `bin/`. tmux-battery, tmux-cpu and the nowplaying Swift binary were removed (unused). The maintenance job is cleanup-only (no unattended upgrades). VPN gateways stay in the untracked `~/.config/vpn/gateways`.
