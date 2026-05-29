# setthemacup

Full macOS dev environment setup — one command from a fresh machine.

```bash
curl -fsSL https://raw.githubusercontent.com/mahi160/setthemacup/main/bootstrap.sh | bash
```

---

## What it does

`bootstrap.sh` clones this repo to `~/.setup` then hands off to `scripts/macinstall.sh`, which runs 15 steps in order:

| # | Step | What |
|---|---|---|
| 1 | `set_homebrew` | Installs Homebrew, bootstraps PATH |
| 2 | `set_apps` | All CLI tools, GUI apps, fonts — reads from `scripts/apps.json` |
| 3 | `set_store_apps` | App Store apps via `mas` + Raycast + FortiClient DMG |
| 4 | `set_dotfiles` | Stow all configs (ghostty, tmux, nvim, zsh, starship, fastfetch, pi) |
| 5 | `set_git` | Global git identity (personal) |
| 6 | `set_node` | fnm → Node LTS → pnpm |
| 7 | `set_nvim` | Lazy sync (main nvim) + vim.pack bootstrap (nvim.12) |
| 8 | `set_pi` | Pi coding agent + claude extension deps |
| 9 | `set_ai` | AI skills via `npx skills add` |
| 10 | `set_ssh` | Generate ed25519 keys (personal + work), print for GitHub |
| 11 | `set_mac_cleanup` | Clear dock, disable Siri / Game Center / analytics |
| 12 | `set_mac_defaults` | Keyboard, Finder, trackpad, spaces, screenshots |
| 13 | `set_network_shares` | Auto-mount SMB shares on login via LaunchAgent |
| 14 | `set_tmux_helpers` | Compile Swift nowplaying binary + install tmux-battery/cpu scripts |
| 15 | `set_crontab` | Weekly maintenance jobs (pi-prune, fnm-clean) |

---

## Re-running

Every step is idempotent — safe to re-run at any time.

```bash
bash ~/.setup/scripts/macinstall.sh            # full run
bash ~/.setup/scripts/macinstall.sh set_apps   # single step
```

---

## Structure

```
setthemacup/
├── bootstrap.sh              # entry point (curl | bash)
├── scripts/
│   ├── macinstall.sh         # 15-step installer
│   ├── apps.json             # app manifest (formulae, casks, mas, dmg, smb)
│   ├── compile-nowplaying.sh # compile Swift nowplaying binary for tmux
│   ├── tmux-battery.sh       # battery icon+% for tmux status bar (→ ~/.local/bin)
│   ├── tmux-cpu.sh           # cpu icon+% for tmux status bar (→ ~/.local/bin)
│   ├── dev.sh                # smart tmux dev session launcher
│   ├── note.sh               # quick note/learn capture to Obsidian
│   ├── pokemon-bg.sh         # cycle Ghostty background pokemon
│   ├── crontab-setup.sh      # install weekly cron jobs
│   └── pi-prune.sh           # delete old pi sessions (run by cron)
└── dotfiles/
    ├── ghostty/              # Ghostty terminal config
    ├── tmux/                 # tmux config (no TPM — all native)
    ├── nvim/
    │   ├── .config/nvim/     # LazyVim-based config (alias: nvim)
    │   └── .config/nvim.12/  # lean vim.pack + mini.nvim config (alias: vm)
    ├── zsh/                  # .zshrc + .zshenv (no OMZ — direct brew plugins)
    ├── starship/             # starship prompt (gruvbox material themed)
    ├── fastfetch/            # fastfetch system info (login shells only)
    ├── pi/                   # pi coding agent config
    └── stow/                 # .stow-global-ignore
```

---

## After install

1. Paste SSH public keys into [github.com/settings/keys](https://github.com/settings/keys)
2. Set `ANTHROPIC_API_KEY` in your shell environment
3. Sign in to App Store (if skipped during install)
4. Add SMB credentials to Keychain Access for auto-mount shares
5. Run `pokemon-bg` to set your first Ghostty background

---

## Key aliases

| Alias | What |
|-------|------|
| `v` | nvim (LazyVim) |
| `vm` | nvim.12 (lean vim.pack config) |
| `dev` | smart tmux session launcher |
| `y` | yazi (cd on exit) |
| `zc` | open this repo in a tmux config session |
| `a` | pi coding agent |
| `note` / `of` | quick note capture / onefetch |
