# Dotfiles Hardening Plan

Derived from the full audit. Wakatime is kept intentionally.
Sessions are already gitignored — confirmed clean. nvim.12 is live (vm alias) — untouched.

---

## Context

Memory at 71% with tmux idle. Shell starts in ~0.9s. tmux status bar compiles a Swift
script from source every 5 seconds. Two TypeScript LSP servers run simultaneously.
Custom plugins load unconditionally at startup. Five dead Neovim config symlinks litter
`~/.config`. Three AI agents compete for the same role. All fixable without changing the
day-to-day workflow.

---

## Approach

1. Git-commit the current state as a backup checkpoint before any edit.
2. Work layer by layer: tmux → Neovim → Shell → Ghostty → Filesystem.
3. Every file touched gets a `.bak` copy alongside it before modification, committed to
   the repo so the backup travels with the dotfiles.
4. No nuclear removals in one pass — each section is independently revertable.

---

## Files to Modify

| File | Change |
|---|---|
| `dotfiles/tmux/.config/tmux/tmux.conf` | status-interval, default-terminal, remove duplicate pbcopy, escape-time tweak |
| `dotfiles/nvim/.config/nvim/lua/config/lazy.lua` | `lazy = true` |
| `dotfiles/nvim/.config/nvim/lazyvim.json` | remove `lang.typescript` (keep vtsls), remove `ui.smear-cursor` |
| `dotfiles/nvim/.config/nvim/lua/plugins/misc.lua` | remove lorem, better-escape; add lazy triggers to remaining |
| `dotfiles/nvim/.config/nvim/lua/plugins/dashboard.lua` | no change (cosmetic risk not worth it now) |
| `dotfiles/zsh/.zshrc` | gate fastfetch to login-only, lazy-load thefuck, fix PATH dupes |
| `dotfiles/ghostty/.config/ghostty/config` | reduce blur-radius |
| `scripts/` | add compile-nowplaying.sh, add crontab-setup.sh |

---

## Pre-work: Backup Checkpoint

### Step 1 — Git commit current state
```bash
cd ~/Documents/Coding/Projects/setthemacup
git add -A
git commit -m "chore: pre-hardening backup checkpoint [$(date +%Y-%m-%d)]"
```
This is the canonical rollback point. Every individual change below is an additional commit
so you can `git revert` any single step.

### Step 2 — Back up dead-but-existing data dirs (outside git)
```bash
# nvim-chad has 172MB of data but no config source — archive before deleting
tar -czf ~/Desktop/nvim-chad-data-backup.tar.gz ~/.local/share/nvim-chad
# nvim.12 data dir is LIVE (vm alias) — do NOT touch
```

### Step 3 — Note the .bak convention
Before each config file is modified, the script (or you manually) copies it:
```bash
cp dotfiles/tmux/.config/tmux/tmux.conf \
   dotfiles/tmux/.config/tmux/tmux.conf.bak
```
These `.bak` files are committed so the backup is in git history alongside the change.

---

## Steps

### Phase 1 — tmux (highest runtime impact)

- [ ] **1.1 Pre-compile nowplaying Swift binary**
  - Create `scripts/compile-nowplaying.sh`:
    ```bash
    #!/usr/bin/env bash
    SCRIPT="$HOME/.config/tmux/plugins/tmux-nowplaying/scripts/nowplaying_mediaremote.swift"
    BINARY="$HOME/.local/bin/nowplaying-mediaremote"
    mkdir -p "$(dirname "$BINARY")"
    if [[ ! -f "$BINARY" || "$SCRIPT" -nt "$BINARY" ]]; then
      swiftc "$SCRIPT" -o "$BINARY" 2>/dev/null && echo "compiled" || echo "failed"
    fi
    ```
  - Edit `nowplaying.tmux` to call the binary instead of the swift script.
    The plugin's `nowplaying_interpolation()` function replaces `#{nowplaying}` with
    `#($CURRENT_DIR/scripts/nowplaying.sh)`. Change `nowplaying.sh` to call the binary
    if it exists, fall back to swift script otherwise:
    ```bash
    # In nowplaying.sh, replace the Darwin case block:
    Darwin)
      BINARY="$HOME/.local/bin/nowplaying-mediaremote"
      if [[ -x "$BINARY" ]]; then
        output="$("$BINARY" 2>/dev/null)"
      else
        output="$("$SCRIPT_DIR/nowplaying_mediaremote.swift" 2>/dev/null)"
      fi
      ;;
    ```
  - Run `compile-nowplaying.sh` once after setup, and add it to `macinstall.sh`.
  - **Expected win:** 155ms → ~5ms per status tick.

- [ ] **1.2 Increase status-interval to 15**
  - `dotfiles/tmux/.config/tmux/tmux.conf`:
    ```
    set -g status-interval 15   # was 5
    ```
  - Battery and CPU scripts run every 15s instead of every 5s.

- [ ] **1.3 Fix default-terminal**
  - Change:
    ```
    set -g default-terminal "${TERM}"
    ```
    To:
    ```
    set -g default-terminal "tmux-256color"
    ```
  - The `${TERM}` interpolation is evaluated at config-load time, not per-pane.
    `tmux-256color` is the correct and consistent value for modern tmux.

- [ ] **1.4 Remove duplicate pbcopy clipboard binding**
  - The manual `pbcopy` bindings on lines 165–166 duplicate what `tmux-yank` does.
    Remove these three lines:
    ```conf
    # DELETE these:
    bind -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "pbcopy"
    bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"
    ```
  - Keep the `if-shell` block wrapper, just empty it or remove the whole block.
    `tmux-yank` handles this correctly and respects OSC 52.

- [ ] **1.5 Remove dead `set-option -g utf8-on on`**
  - This option was removed in tmux 2.2. It silently no-ops but clutters config.

- [ ] **1.6 Adjust escape-time to 10**
  - Change `set -sg escape-time 0` → `set -sg escape-time 10`
  - 0ms causes edge-case issues with non-Neovim TUI programs. 10ms is imperceptible
    to humans and safe for Neovim.

---

### Phase 2 — Neovim (memory + startup)

- [ ] **2.1 Set `defaults.lazy = true` in lazy.lua**
  - File: `lua/config/lazy.lua`
  - Change one character:
    ```lua
    defaults = {
      lazy = true,   -- was false
    ```
  - Impact: `lorem.nvim`, `better-escape.nvim`, `live-preview.nvim`, `vim-wakatime`,
    and `oil.nvim` stop loading unconditionally at startup.
  - Any plugin that *needs* to be eager must explicitly declare
    `lazy = false` in its spec. Current plugins that legitimately need it:
    `gruvbox-material` (colorscheme) and `snacks.nvim` (dashboard). Both are already
    handled by LazyVim's own specs.

- [ ] **2.2 Remove `lang.typescript` extra from lazyvim.json**
  - Remove this line:
    ```json
    "lazyvim.plugins.extras.lang.typescript",
    ```
  - Keep `"lazyvim.plugins.extras.lang.typescript.vtsls"`.
  - This eliminates the duplicate TypeScript LSP. Run `:MasonUninstall typescript-language-server`
    after applying to reclaim disk.
  - **Expected win:** 200–500MB RAM per Neovim instance on TS projects.

- [ ] **2.3 Remove `ui.smear-cursor` extra from lazyvim.json**
  - Remove: `"lazyvim.plugins.extras.ui.smear-cursor"`
  - `smear-cursor.nvim` conflicts with `noice.nvim` (both intercept redraws).
    Pure cosmetic, not worth the instability.

- [ ] **2.4 Clean up misc.lua — remove lorem.nvim and better-escape.nvim**
  - `lorem.nvim` (23MB): no replacement needed. Use `:r !cat /dev/urandom | base64 | head -5`
    or just type it.
  - `better-escape.nvim`: LazyVim already handles `jk` escape mapping via its own
    keymaps. This plugin is redundant.
  - New `misc.lua`:
    ```lua
    return {
      {
        "brianhuster/live-preview.nvim",
        cmd = { "LivePreview" },  -- lazy: only load when command is used
      },
      {
        "wakatime/vim-wakatime",
        event = "VeryLazy",      -- load after startup, not at it
      },
    }
    ```

- [ ] **2.5 Remove markdown-preview.nvim from lazy-lock.json + stop it loading**
  - `markdown-preview.nvim` (62MB Node.js app) is superseded by `live-preview.nvim`.
  - Add a disable spec to `misc.lua` (or a new `overrides.lua`):
    ```lua
    { "iamcco/markdown-preview.nvim", enabled = false },
    ```
  - Then run `:Lazy clean` to remove it from disk. This frees 62MB.
  - **Note:** If `markdown-preview.nvim` is brought in by a LazyVim extra, this
    disable spec is the correct removal mechanism. Check with `:Lazy` after applying.

- [ ] **2.6 Fix double `gruvbox_material_enable_italic` in colorscheme.lua**
  - File: `lua/plugins/colorscheme.lua`
  - Remove the duplicate line (set twice in the same `config` function).

---

### Phase 3 — Shell (startup time)

- [ ] **3.1 Gate fastfetch to login shells only**
  - Currently `fastfetch` is the first line of `.zshrc`, running on every shell
    invocation: tmux splits, subshells, agent-spawned processes.
  - Wrap it:
    ```zsh
    # Only show system info in login shells, not every subshell
    [[ -o login ]] && fastfetch
    ```
  - **Expected win:** Every tmux split and agent subshell no longer forks fastfetch.

- [ ] **3.2 Lazy-load thefuck**
  - `eval "$(thefuck --alias)"` spawns a Python interpreter at every shell start.
  - Replace with a lazy wrapper that only initialises thefuck the first time `fuck`
    is actually typed:
    ```zsh
    # Lazy thefuck: initialise only on first use
    fuck() {
      eval "$(thefuck --alias)" && unset -f fuck && fuck "$@"
    }
    ```
  - This eliminates the Python startup cost from the shell critical path entirely.

- [ ] **3.3 Fix duplicate PATH entries**
  - `.bun/bin`, `.opencode/bin`, `.orbstack/bin` appear twice (once in `.zshrc`,
    once from `.zprofile` / `orbstack init.zsh`).
  - The existing `pnpm` guard pattern already shows the fix:
    ```zsh
    # Replace bare exports with guarded ones:
    case ":$PATH:" in
      *":$HOME/.opencode/bin:"*) ;;
      *) export PATH="$HOME/.opencode/bin:$PATH" ;;
    esac

    case ":$PATH:" in
      *":$BUN_INSTALL/bin:"*) ;;
      *) export PATH="$BUN_INSTALL/bin:$PATH" ;;
    esac
    ```

- [ ] **3.4 Fix git identity aliases to use --local**
  - Change:
    ```zsh
    alias gp="git config user.name \"mahi160\" && git config user.email \"...\""
    alias gw="git config user.name \"salauddin-sifat-qp\" && git config user.email \"...\""
    ```
    To:
    ```zsh
    alias gp="git config --local user.name \"mahi160\" && git config --local user.email \"omarsifat288@gmail.com\""
    alias gw="git config --local user.name \"salauddin-sifat-qp\" && git config --local user.email \"salauddin.sifat@questionpro.com\""
    ```
  - Prevents one identity switch from silently affecting all other repos system-wide.

---

### Phase 4 — Ghostty (GPU overhead)

- [ ] **4.1 Reduce blur-radius from 120 to 20**
  - File: `dotfiles/ghostty/.config/ghostty/config`
  - Change:
    ```
    background-blur-radius = 20   # was 120
    ```
  - Radius 120 operates on a huge pixel neighborhood per frame. 20 is visually
    indistinguishable from 120 at 96% opacity and cuts GPU compositing work significantly.

- [ ] **4.2 Set clipboard-read to ask (security)**
  - Change:
    ```
    clipboard-read = ask    # was allow
    ```
  - Prevents any terminal program (including AI agents) from silently reading your
    clipboard contents without a visible prompt.

---

### Phase 5 — Filesystem Cleanup

- [ ] **5.1 Remove 5 dead symlinks from ~/.config**
  - These all point to non-existent targets:
    ```bash
    rm ~/.config/nvim-0.12
    rm ~/.config/nvim-chad
    rm ~/.config/nvim.12.old
    rm ~/.config/nvim.bak
    rm ~/.config/nvim.minimax
    ```
  - The configs they pointed to no longer exist in dotfiles. No data loss.

- [ ] **5.2 Remove dead nvim-chad data dir**
  - First create the tar backup (Step 2 above), then:
    ```bash
    rm -rf ~/.local/share/nvim-chad
    ```
  - Frees 172MB.

- [ ] **5.3 Add cron setup script**
  - Create `scripts/crontab-setup.sh`:
    ```bash
    #!/usr/bin/env bash
    # Idempotent — safe to run multiple times
    PRUNE="0 3 * * 0 $HOME/Documents/Coding/Projects/setthemacup/scripts/pi-prune.sh >> /tmp/pi-prune.log 2>&1"
    FNM="0 4 * * 0 find $HOME/.local/state/fnm_multishells -mindepth 1 -maxdepth 1 -mtime +7 -exec rm -rf {} +"

    (crontab -l 2>/dev/null | grep -v "pi-prune\|fnm_multishells"; echo "$PRUNE"; echo "$FNM") | crontab -
    echo "Cron entries installed."
    ```
  - Run once: `bash scripts/crontab-setup.sh`
  - This starts the pi session cleanup (30-day TTL) and fnm multishell drain (7-day TTL).

- [ ] **5.4 Remove opencode**
  - Remove from PATH in `.zshrc`:
    ```zsh
    # DELETE this line:
    export PATH=/Users/mahi/.opencode/bin:$PATH
    ```
  - Remove the binary and config:
    ```bash
    rm -rf ~/.opencode
    rm -rf ~/.config/opencode
    ```
  - This removes the third AI agent entirely. Pi is primary.
  - **Expected win:** 1 fewer entry in PATH (already duplicated), ~50MB freed, one less background connection.

- [ ] **5.5 Initial fnm multishell cleanup (one-time)**
  - 3,095 stale symlinks, done now rather than waiting for cron:
    ```bash
    find ~/.local/state/fnm_multishells -mindepth 1 -maxdepth 1 -mtime +1 -exec rm -rf {} +
    ```
  - Use `-mtime +1` (older than 1 day) to avoid deleting currently-active shells.
  - Also remove the `.opencode/bin` guard from the PATH dedup step (Step 3.3) since the binary will be gone.

---

## Reuse

- `scripts/pi-prune.sh` — already correct, just needs cron wiring (Step 5.3).
- `dotfiles/stow/` — stow convention already in place, no changes needed.
- `dotfiles/tmux/.config/tmux/plugins/tmux-nowplaying/scripts/nowplaying.sh` — edit
  in-place to add binary fallback (Step 1.1).
- `.gitignore` at repo root — already covers sessions and stats.db correctly.

---

## Deferred (Intentional)

| Item | Reason Deferred |
|---|---|
| Remove `vim-wakatime` | User intends to replace with custom implementation |
| Replace oh-my-zsh | Significant workflow disruption; separate plan needed |
| ~~Remove `opencode`~~ | **Moved to Phase 5** — confirmed for removal |
| Remove `noice.nvim` | High disruption; separate plan |
| Containerise agents | Architectural change; needs design session |
| Dashboard pokemon subprocess | Risk/reward too low for now |

---

## Verification

After all steps are applied:

```bash
# Shell startup (target: <400ms)
time zsh -i -c exit

# tmux status tick cost (target: <10ms)
time ~/.local/bin/nowplaying-mediaremote

# Neovim startup (target: no regression from 47ms headless)
time nvim --headless -c "qa"

# PATH duplicates (target: 0)
echo $PATH | tr ':' '\n' | sort | uniq -d

# Dead symlinks (target: 0)
for l in nvim-0.12 nvim-chad nvim.12.old nvim.bak nvim.minimax; do
  [ -L ~/.config/$l ] && echo "STILL EXISTS: $l"
done

# Cron entries
crontab -l | grep -E "pi-prune|fnm"

# Confirm single TS LSP
nvim --headless -c "LspInfo" -c "qa" 2>&1 | grep -i typescript
```

---

## Commit Strategy

Each phase = one commit, so any phase is independently revertable:

```
chore: pre-hardening backup checkpoint
fix(tmux): compile nowplaying binary, raise status-interval, fix terminal
fix(nvim): lazy=true, remove duplicate TS LSP, drop lorem/better-escape/markdown-preview
fix(zsh): gate fastfetch, lazy thefuck, guard PATH, fix git identity aliases  
fix(ghostty): reduce blur-radius, set clipboard-read=ask
chore: remove dead nvim symlinks and nvim-chad data dir
chore: remove opencode binary, config, and PATH entry
chore: add crontab-setup.sh and compile-nowplaying.sh scripts
```
