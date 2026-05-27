# setthemacup

Full macOS dev environment setup — one command from a fresh machine.

```bash
curl -fsSL https://raw.githubusercontent.com/mahi160/setthemacup/main/bootstrap.sh | bash
```

---

## What it does

`bootstrap.sh` clones this repo then hands off to `scripts/macinstall.sh`, which runs 14 steps in order:

| # | Step | What |
|---|---|---|
| 1 | `set_homebrew` | Installs Homebrew |
| 2 | `set_apps` | All CLI tools, GUI apps, fonts — reads from `scripts/apps.json` |
| 3 | `set_store_apps` | App Store apps via `mas` + Raycast + FortiClient DMG |
| 4 | `set_dotfiles` | oh-my-zsh, stow all configs, TPM + tmux plugins |
| 5 | `set_git` | Global git identity (personal) |
| 6 | `set_node` | fnm → Node LTS → pnpm |
| 7 | `set_nvim` | Lazy sync plugins, clean disabled ones |
| 8 | `set_pi` | Pi coding agent + claude extension deps |
| 9 | `set_ai` | AI skills via `npx skills add` — vercel, anthropic, mattpocock, caveman, security-review |
| 10 | `set_ssh` | Generate ed25519 keys (personal + work), print for GitHub |
| 11 | `set_mac_cleanup` | Clear dock, disable Siri/Game Center/analytics |
| 12 | `set_mac_defaults` | Keyboard, Finder, trackpad, spaces |
| 13 | `set_network_shares` | Auto-mount SMB shares on login via LaunchAgent |
| 14 | `set_nowplaying_binary` | Compile Swift nowplaying binary for tmux status bar |
| 15 | `set_crontab` | Weekly pi session pruning + fnm multishell cleanup |

---

## After it finishes

Three things need you:

1. **SSH keys** — script generates and prints them. Paste into [github.com/settings/keys](https://github.com/settings/keys)
2. **API keys** — set `ANTHROPIC_API_KEY` etc. manually (never stored in dotfiles)
3. **App Store** — sign in before running, or MAS step skips gracefully
4. **terrorCastle** — first login prompts for SMB credentials, tick "Remember in Keychain"

---

## Stack

**Terminal:** Ghostty · tmux · zsh + oh-my-zsh  
**Editor:** Neovim (LazyVim) · Zed  
**Prompt:** Starship  
**Files:** yazi · eza · bat · fd · ripgrep · fzf  
**Git:** lazygit · gh  
**AI:** pi · Claude Code  
**Skills:** frontend-design · security-review · vercel-react-best-practices · web-design-guidelines · caveman · grill-with-docs · to-prd · write-a-skill  
**Runtimes:** Node (fnm) · pnpm · uv (Python)  
**Infra:** OrbStack · docker-compose · tailscale  

---

## Customise apps

All apps live in [`scripts/apps.json`](scripts/apps.json) — edit there, not in the script.

```json
{ "name": "some-tool", "desc": "What it does" }
```

Sections: `formulae` (brew), `casks` (brew --cask), `mas` (App Store), `dmg` (direct download), `smb` (network shares), `ai_skills` (npx skills).

---

## Dotfiles structure

```
dotfiles/
├── ghostty/   → ~/.config/ghostty/     Terminal config + Gruvbox theme
├── nvim/      → ~/.config/nvim/        LazyVim + custom plugins
├── tmux/      → ~/.config/tmux/        tmux config (plugins managed by TPM at runtime)
├── zsh/       → ~/                     .zshrc + .zshenv
├── pi/        → ~/.pi/                 Pi agent settings + extensions
├── starship/  → ~/.config/             starship.toml
├── fastfetch/ → ~/.config/fastfetch/   System info config
└── stow/      → ~/                     .stow-global-ignore
```

Symlinked via [GNU stow](https://www.gnu.org/software/stow/).

---

## Neovim

LazyVim base with:

- **LSPs:** TypeScript (vtsls), CSS, JSON, Go, Svelte, TailwindCSS, ESLint, Docker, Markdown
- **Formatter:** Prettier + conform.nvim
- **AI:** Supermaven
- **Extras:** mini-diff, render-markdown, oil.nvim, grug-far, snacks dashboard
- **Theme:** Gruvbox Material (hard, transparent)

---

## tmux

- Prefix: `C-a`
- Plugins: tmux-sensible, tmux-cpu, tmux-battery, tmux-resurrect, tmux-continuum, tmux-yank
- Now playing: compiled Swift binary calling macOS MediaRemote — no plugin, no recompile on every tick
- Sessions persist across reboots via continuum (15 min autosave)

---

## Scripts

| Script | What |
|---|---|
| `bootstrap.sh` | curl entry point — Xcode CLT → clone → macinstall |
| `scripts/macinstall.sh` | Full setup orchestrator |
| `scripts/apps.json` | Declarative app manifest |
| `scripts/dev.sh` | Spin up a dev tmux session: `dev --dir ~/project` |
| `scripts/note.sh` | Append a timestamped note to yearly markdown file |
| `scripts/pokemon-bg.sh` | Cycle Ghostty background to a random Pokémon (Alt+Q) |
| `scripts/compile-nowplaying.sh` | Compile Swift nowplaying source to binary |
| `scripts/crontab-setup.sh` | Install weekly maintenance cron jobs |
| `scripts/pi-prune.sh` | Delete pi sessions older than 30 days, checkpoint WAL |

---

## Re-running

Safe to re-run on an existing machine — every step checks before acting. Useful after adding something to `apps.json`:

```bash
bash ~/Documents/Coding/Projects/setthemacup/scripts/macinstall.sh
```
