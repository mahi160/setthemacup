# AGENTS.md — setthemacup

> Read this before touching anything in this repo.
> One file. Covers everything.

---

## What this repo is

Full macOS dev environment. One command from a fresh machine:
```bash
curl -fsSL https://raw.githubusercontent.com/mahi160/setthemacup/main/bootstrap.sh | bash
```

`bootstrap.sh` → clones repo to `~/.setup` → runs `setup/main.sh` (16 idempotent steps).

---

## Repo layout

```
~/.setup/
├── bootstrap.sh              # entry point
├── AGENTS.md                 # ← you are here
├── README.md                 # human-facing docs
├── scripts/
│   ├── main.sh               # → setup/main.sh (see below)
│   ├── apps.json             # → setup/apps.json
│   └── *.sh, *.swift         # Helper scripts: compile-nowplaying, crontab-setup, dev, note, pokemon-bg, pi-prune, pi-notify-icon, set-display-resolution, nowplaying_mediaremote, tmux-battery/cpu/git/nowplaying, pi-qna, quick-note, quick-learn
└── dotfiles/                 # stowed by GNU stow into $HOME
    ├── fastfetch/            → ~/.config/fastfetch/config.jsonc
    ├── ghostty/              → ~/.config/ghostty/config
    ├── git/                  → ~/.gitconfig + ~/.gitignore_global
    ├── lazygit/              → ~/.config/lazygit/config.yml
    ├── nvim/                 → ~/.config/nvim/ + ~/.config/nvim.12/
    ├── pi/                   → ~/.pi/agent/ (full directory symlinked; extensions, settings, keybindings, etc.)
    ├── starship/             → ~/.config/starship.toml
    ├── stow/                 → ~/.stow-global-ignore
    ├── tmux/                 → ~/.config/tmux/tmux.conf
    ├── yazi/                 → ~/.config/yazi/{yazi.toml,keymap.toml}
    └── zsh/                  → ~/.zshrc + ~/.zshenv
```

---

## setup/ — the 16 steps

Entry point: `setup/main.sh`. Each step is a standalone file `setup/NN-name.sh` that sources `setup/lib.sh`.
Single step: `bash setup/main.sh apps` or `bash setup/02-apps.sh` directly.

| # | fn | what |
|---|---|---|
| 1 | `set_homebrew` | install brew, bootstrap PATH (NOT in subshell — exports to outer shell) |
| 2 | `set_apps` | install all brew formulae + casks from `apps.json` |
| 3 | `set_store_apps` | mas App Store + DMG apps (Raycast, FortiClient) |
| 4 | `set_dotfiles` | stow all dotfile packages (11 packages), fetch starter pokemon |
| 5 | `set_git` | global git identity (personal: mahi160) |
| 6 | `set_node` | fnm → Node LTS → pnpm (NOT in subshell — exports to outer shell) |
| 7 | `set_nvim` | LazyVim headless sync + nvim.12 headless bootstrap |
| 8 | `set_pi` | pnpm install pi coding agent globally |
| 9 | `set_ai` | npx skills add for each entry in apps.json `ai_skills` |
| 10 | `set_ssh` | generate ed25519 keys (personal + work), print pubkeys |
| 11 | `set_mac_cleanup` | clear dock, disable Siri/Game Center/analytics |
| 12 | `set_mac_defaults` | keyboard/finder/trackpad/spaces/screenshots via `defaults write` |
| 13 | `set_network` | LaunchAgent plist per SMB entry in apps.json |
| 14 | `set_nowplaying` | compile Swift binary + install 7 tmux helpers to ~/.local/bin/ |
| 15 | `set_crontab` | weekly pi-prune + fnm-clean cron entries |
| 16 | `set_display` | set display scaling to "More Space" |

**Adding a new step:** create `setup/NN-name.sh` defining `set_name()` (follow existing pattern). Add `name` to the steps list in `setup/main.sh`. If critical, add to `CRITICAL_STEPS`.

**Running one step:**
```bash
bash ~/.setup/setup/main.sh apps
bash ~/.setup/setup/02-apps.sh   # standalone
```

---

## apps.json — adding packages

```json
{ "name": "formula-name", "desc": "what it does" }  // → formulae array
{ "name": "cask-name",    "desc": "what it does" }  // → casks array
```

- Tap-prefixed formulas work: `"name": "owner/tap/formula"` → `brew install owner/tap/formula`
- Font casks go in `casks`: `"name": "font-jetbrains-mono-nerd-font"`
- No duplicate entries — setup checks `brew list` before installing
- File lives at `setup/apps.json` (not `scripts/apps.json`)

---

## Dotfiles — stow rules

- Stowed with GNU stow from `dotfiles/` into `$HOME`
- `.stow-global-ignore` uses **Perl regex** (not shell globs):
  - `\.DS_Store$` not `*.DS_Store`
  - `.*\.md$` not `*.md`
  - `LICEN[CS]E$` covers both spellings
- `.md` files are ignored → they never land in `$HOME` — safe to add docs anywhere in dotfiles
- Add new dotfile package: create `dotfiles/pkgname/` mirroring the `$HOME` structure, add `pkgname` to the `packages=()` array in `set_dotfiles`

---

## zsh

- **No oh-my-zsh.** No plugin manager.
- Plugins sourced directly from brew:
  ```zsh
  source "$BREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh"
  source "$BREW_PREFIX/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
  ```
- `zoxide` replaces OMZ `z` plugin — same `z` command
- `compinit -C` skips security audit; regenerates dump if >24h old
- fastfetch only runs in login shells: `[[ -o login ]] && fastfetch`
- `SETTHEMACUP` env var always points to `~/.setup` (set in `.zshenv`)

---

## tmux

- **No TPM. No plugins. Fully native.**
- Status bar widgets are shell scripts in `~/.local/bin/`:
  - `tmux-battery` — uses `pmset`, outputs icon + %
  - `tmux-cpu` — uses `ps` + `sysctl`, outputs icon + %
  - `nowplaying-mediaremote` — compiled Swift binary (~5ms), source in `scripts/`
- Plugin format strings (`#{battery_icon}` etc.) have **no provider** — never use them
- Clipboard: native `pbcopy` via `copy-pipe-and-cancel`
- `escape-time 10` — do NOT set to 0
- `status-interval 5` — drives nowplaying refresh
- Active theme: **Gruvbox Material** — color vars: `#{@thm_bg}` `#{@thm_fg}` `#{@thm_acc1}`–`4` `#{@thm_gray}` `#{@thm_darkgray}`
- Reload: `C-a r`

---

## ghostty

- Terminal: Ghostty 1.3.1, Metal renderer (macOS)
- Font: `JetBrainsMono Nerd Font` (installed via `font-jetbrains-mono-nerd-font` cask)
- Background image path: `~/Pictures/pokemon_bg/current.png` (symlinked to random starter; managed by `scripts/pokemon-bg.sh`)
- `background-blur = 240` (single key — not `background-blur = true` + separate radius)
- `macos-option-as-alt = true` enables Alt key for tmux/zsh bindings
- `confirm-close-surface = false` — no close prompt

---

## starship

- Config: `~/.config/starship.toml`
- **Explicit top-level `format`** — only listed modules are scanned. Do not remove it.
- `scan_timeout = 10` — prevents slow prompts in large repos
- Theme: **Gruvbox Material** matching tmux/nvim:
  - `#d8a657` yellow → directory, python
  - `#a9b665` green → git branch, nodejs, ❯ success
  - `#e78a4e` orange → git status, rust
  - `#7daea3` aqua → os icon, golang, docker
  - `#928374` gray → cmd_duration, time
- `[username]`, `[hostname]`, `[localip]` — all disabled (personal machine)
- Two-line prompt: info line + `❯` character line

---

## neovim

### Main config (`nvim`, alias `v`) — LazyVim

- Plugin manager: `lazy.nvim`
- Oil: `lazy = false` — required for `nvim .` to open oil instead of netrw
- Colorscheme: gruvbox-material (`better_performance = 1`, `transparent_background = 2`)
- Diagnostics: `virtual_text = false` — tiny-inline-diagnostic used instead

### nvim.12 (`vm` alias) — lean custom config

- Plugin manager: `vim.pack` (Neovim 0.12 native)
- **No lazy.nvim, no lazy loading** — everything loads at startup
- Neovim 0.12 UI enabled: `require("vim._core.ui2").enable({})`
- mini.nvim ecosystem (~20 modules from one repo)
- Completion: `blink.cmp` with Rust fuzzy + supermaven ghost text
- LSP: native `vim.lsp.config` + `vim.lsp.enable` (no lspconfig wrapper needed in 0.12)
- Format: `conform.nvim` — `async = true`, `timeout_ms = 1000`
- Lint: `nvim-lint` on `BufWritePost` + `InsertLeave` only (NOT BufReadPost)
- `mini.basics` options disabled — `01_core.lua` owns all vim options
- `oxlint` installed via mason and wired in lint for JS/TS alongside `eslint_d`
- Fuzzy finder: `mini.pick` with frecency (mini.visits) — `<leader><leader>`

---

## fastfetch

- Runs on login shells only (gated in `.zshrc`)
- Logo: `pokemon-colorscripts -r 1 --no-title` (installed via `nicowillis/programs/pokemon-colorscripts-mac`)
- Modules: title, os, kernel, host, uptime, memory, cpu — **no packages** (too slow)

---

## git, lazygit, yazi

### git
- Config: `~/.gitconfig` (stowed from `dotfiles/git/`)
- Global ignore: `~/.gitignore_global` (stowed from `dotfiles/git/`)

### lazygit
- Config: `~/.config/lazygit/config.yml` (stowed from dotfiles)
- Theme: kanagawa-lotus

### yazi
- Configs: `~/.config/yazi/{yazi.toml,keymap.toml}` (stowed from dotfiles)

---

## key conventions

| Thing | Convention |
|-------|-----------|
| Colors | Always use `@thm_*` vars in tmux; hex matching gruvbox material elsewhere |
| Paths | Use `~` or `$HOME` — never hardcode `/Users/mahi` |
| Shell patterns | Use `case ":$PATH:"` guard for PATH additions |
| Regex in stow | Perl regex — `.*\.ext$` not `*.ext` |
| Brew tap formulas | Full path `owner/tap/name` works in apps.json |
| New binaries | Install to `~/.local/bin/` — already in PATH via `.zshenv` |
| Paths in config | Use `~/.` not `/Users/mahi/` |
| Scripts | `set -euo pipefail`, derive paths from `$0` not hardcoded |

---

## hard rules

- **No oh-my-zsh** — use brew plugins sourced directly
- **No TPM** — tmux is fully native; status bar uses `~/.local/bin/` scripts
- **No hardcoded `/Users/mahi`** anywhere
- **No `prefix2 none`** in tmux — invalid key, silently errors
- **No `escape-time 0`** in tmux — use 10ms minimum
- **No `*.ext` in stow ignore** — use Perl regex `.*\.ext$`
- **No `background-blur-radius`** in ghostty — use `background-blur = N`
- **No plugin format strings in tmux** (`#{battery_icon}` etc.) without a provider
- **Do not commit or push** unless explicitly asked
