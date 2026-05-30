# Plan: Adopt the best parts of `nvim-scratch` into `nvim.12`

## Context
`Sin-cy/nvim-scratch` is a minimal Neovim 0.13 config built on native `vim.pack`,
mini.nvim, and native LSP. My `nvim.12` config is a superset of it — it already
uses `vim.pack`, mini.nvim, native LSP, treesitter, and adds blink.cmp, oil,
conform, nvim-lint, mason, grug-far, dadbod, etc.

So "best parts" = the small, genuinely-additive options/keymaps/commands that
`nvim-scratch` has and mine lacks. Plugin-level differences (mini.files,
mini.completion, mini.snippets-only) would be **downgrades** and are excluded.

## What `nvim-scratch` has that mine doesn't (candidates)

### Options (in their `options.lua`)
- `inccommand = "split"` — live preview of `:s` substitutions in a split. **Strong add.**
- `completeopt = "menuone,noselect,fuzzy,nosort"` — N/A, I use blink.cmp.
- `laststatus = 3` — global statusline. (mini.statusline default is 2; needs decision.)
- `guicursor = ""` — force block cursor. (Personal preference; I use smear-cursor.)
- `clipboard:append("unnamedplus")` — I do explicit `<leader>y/p` instead.

### Keymaps (in their `keymaps.lua`)
- `xnoremap p` → `"_dP` — paste over visual selection without clobbering register. **Strong add.**
- `<leader>d` (n,v) → `"_d` — delete without yanking. **Strong add.**
- `J` → `mzJ`z` — join lines keeping cursor in place. **Strong add.**
- `v < / >` → `<gv` / `>gv` — re-indent and keep visual selection. **Strong add.**
- `<leader>X` → `:!chmod +x %` — make current file executable. Nice add.
- `<leader>re` → `:restart` — restart config (Nvim 0.13 `:restart`). Nice add.
- `<leader>s` → `:%s/\<word\>/word/gI` — substitute word under cursor. (I have grug-far `<leader>r`; possible conflict with my `<leader>s` search group.)

### Commands (in their `commands.lua`)
- `:PackAdd user/repo …`, `:PackDel …`, `:PackUpdate [names…]` — thin wrappers over
  `vim.pack.add/del/update`. **Nice quality-of-life add** for native plugin mgmt.

## Decided set — add ALL missing additive items
User chose: bring in everything from `nvim-scratch` that mine lacks. Plugin-level
items (mini.files, mini.completion, mini.snippets-only) are still excluded as they
are downgrades vs my oil / blink.cmp / blink+mini.snippets setup.

### Options to add (`01_core.lua`)
- `inccommand = "split"` — live `:s` preview.
- `clipboard:append("unnamedplus")` — sync default register with system clipboard (COMMENTED OUT).
  NOTE: overlaps with my explicit `<leader>y/p` clipboard maps; left for user to uncomment.

### Options EXPLICITLY SKIPPED per user feedback
- `laststatus = 3` — KEEP mini.statusline default (2).
- `guicursor = ""` — DON'T ADD.

### Keymaps to add (`02_keymaps.lua`)
- `x p` → `"_dP` — paste over selection without clobbering register.
- `<leader>d` (n,v) → `"_d` — delete without yanking.
- `J` → `mzJ`z` — join keeping cursor in place.
- visual `<` / `>` → `<gv` / `>gv` — keep selection after (un)indent.
- `<leader>X` → `:!chmod +x %` — make file executable.
- `<leader>re` → `:restart` — restart config.
- `<leader>sw` → `:%s/\<word\>/word/gI` — substitute word under cursor.
  REMAPPED from their `<leader>s` (which collides with my `<leader>s` search group).

### Commands to add (new `lua/15_pack_cmds.lua`)
- `:PackDel …` — delete unused plugins.
- `:PackUpdate [names…]` — update all or specific plugins.

### Commands EXPLICITLY SKIPPED per user feedback
- `:PackAdd` — DON'T INCLUDE (user prefers manual vim.pack.add in code).

### Intentionally skipped (already covered / duplicates)
- `completeopt` fuzzy — N/A, using blink.cmp.
- `mapleader = " "` — already set in `01_core.lua`.
- `<C-c>`/`<Esc>` nohl + insert-Esc — already have `<Esc>` nohl and `jj`.
- mini.files / mini.completion / mini.snippets-only — downgrades vs oil / blink.cmp.

## Files to modify
- `lua/01_core.lua` — add option(s).
- `lua/02_keymaps.lua` — add keymaps.
- New `lua/15_pack_cmds.lua` (numbered so init.lua auto-loads it) — pack commands.
- `lua/qol_mini.lua` — add mini.clue group hints if any new `<leader>` groups appear.
- `CHEATSHEET.md` — document new keymaps.

## Reuse
- `init.lua` auto-requires `lua/[0-9][0-9]_*.lua`, so a new `15_*.lua` is picked up automatically.
- `02_keymaps.lua` already defines `map` + `o(desc)` helpers — reuse them.
- mini.clue in `qol_mini.lua` already documents `<leader>` group prefixes.

## Steps
- [ ] Add the four options to `01_core.lua` (`inccommand`, `laststatus`, `guicursor`, clipboard append).
- [ ] Add keymaps to `02_keymaps.lua` using existing `map`/`o` helpers (incl. `<leader>sw` remap).
- [ ] Create `lua/15_pack_cmds.lua` with `:PackAdd/:PackDel/:PackUpdate` (copy logic from nvim-scratch `commands.lua`).
- [ ] Add `<leader>sw` under the existing `+search` clue group note in `qol_mini.lua` (no new group needed).
- [ ] Document new keymaps/commands in `CHEATSHEET.md`.

## Verification
- Launch `nvim` from this config dir; confirm no startup errors (`:messages`).
- `:s/foo/bar` shows live split preview (inccommand).
- Visual-select + `p` over text doesn't clobber the yank register.
- `<leader>d` deletes without changing `"` register.
- `:PackUpdate` runs; `:PackDel` removes unused plugins.
- CHEATSHEET lists all new keybinds: paste-over, delete-no-yank, join, indent-keep, chmod, restart, substitute-word.

## Resolved decisions
- Scope: add missing additive items, filtering per user feedback.
- `laststatus`: KEEP at 2 (mini.statusline default, not changing to 3).
- `guicursor`: SKIP (don't add `""` force-block).
- `clipboard:append("unnamedplus")`: add but comment out (user can enable if desired).
- `<leader>re`: keep, `:restart` maps to native Nvim 0.13 command.
- `<leader>sw`: keep for substitute-word (distinct from `<leader>r` grug-far).
- `:PackAdd`: SKIP (user prefers code-based plugin addition).
- `:PackDel` & `:PackUpdate`: include (QOL for native vim.pack).
- CHEATSHEET: update to document ALL keybinds in the config (comprehensive reference).
