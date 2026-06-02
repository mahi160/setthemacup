# Plan: Lean & Extend nvim.12 for Web/JS/Go

## Context

`nvim.12` uses `vim.pack` (native Neovim package manager). The config is already well-structured
but carries dead files, orphaned lock entries, unused plugins, and some heavyweight tooling
(Python stack) that doesn't serve a web/JS/Go-only workflow. The git workflow is covered by
lazygit externally + mini.git internally (blame/history keymaps already exist). Additions
are limited to what's genuinely missing: a diagnostics panel and package.json inline info.

---

## 1 — REMOVE / TRIM

### 1a. Dead file
| File | Why |
|---|---|
| `lua/__telescope.lua` | Has `if true then return end` at line 1 — completely inert, just noise |

### 1b. Orphaned lock entries (installed but never loaded)
These exist in `nvim-pack-lock.json` but have zero references in any `.lua` file.
Remove them via `:PackDel` and clean the lock file.

| Plugin | Notes |
|---|---|
| `LuaSnip` | Replaced by `mini.snippets` |
| `better-escape.nvim` | Replaced by the `jj→<Esc>` mapping in `02_keymaps.lua` |
| `fzf-lua` | Replaced by `mini.pick` |
| `monokai-pro.nvim` | Never loaded, no config |
| `plenary.nvim` | Telescope dependency — telescope is disabled |
| `telescope.nvim` | Disabled (`__telescope.lua` bails immediately) |
| `telescope-fzf-native.nvim` | Telescope dependency — disabled |
| `telescope-ui-select.nvim` | Telescope dependency — disabled |
| `tiny-cmdline.nvim` | Not loaded anywhere (replaced by `mini.cmdline`) |
| `which-key.nvim` | Replaced by `mini.clue` |
| `nvim-web-devicons` | Mocked by `mini.icons.mock_nvim_web_devicons()`, unneeded |

### 1c. smear-cursor.nvim — REMOVE
Pure eye candy. Remove the `require("smear_cursor").setup(...)` block from `qol.lua` **and**
the MiniPickStart/MiniPickStop autocmd block in `08_fuzzy_finder.lua` that toggled it.
Run `:PackDel smear-cursor.nvim` to clean the lock entry.

### 1d. Colorscheme bloat (`06_colorscheme.lua`)
4 themes loaded every startup. Keep **gruvbox-material** (primary, active) + **kanagawa** (dark alt).
Drop **everforest** and **tokyonight** — their `vim.pack.add`, config blocks, and lock entries removed.

### 1e. Python tooling — REMOVE
Not needed. Remove from `ensure_installed` and servers:
- LSP: `pyright`
- Formatters: `black`, `isort`
- Linter: `pylint`
- `conform.formatters_by_ft.python` entry
- `lint.linters_by_ft.python` entry

---

## 2 — ADD (genuine gaps)

### 2a. Package.json inline info — `package-info.nvim` (add to `qol.lua`)
Shows latest npm version of each dep as virtual text inline in `package.json`.
Keymaps: `<leader>np` show package info, `<leader>nu` update package on line.

### 2b. Trouble.nvim — `16_trouble.lua`
Already in the lock file (was installed, never wired up). A proper diagnostics/references
panel — better than quickfix for navigating TypeScript/Go errors and LSP references.
Keymaps: `<leader>xd` workspace diagnostics, `<leader>xD` buffer diagnostics,
`<leader>xr` LSP references, `<leader>xq` quickfix in trouble.

### 2c. mini.clue group label to add (`qol_mini.lua`)
```lua
{ mode = "n", keys = "<leader>n", desc = "+npm/packages" },
```

---

## Files to Modify

| File | Change |
|---|---|
| `lua/__telescope.lua` | **Delete** |
| `lua/06_colorscheme.lua` | Drop everforest + tokyonight blocks |
| `lua/08_fuzzy_finder.lua` | Remove MiniPickStart/MiniPickStop smear-cursor autocmd block |
| `lua/10_lsp.lua` | Remove Python servers + mason entries |
| `lua/11_format.lua` | Remove Python formatters/linters |
| `lua/qol.lua` | Remove smear-cursor setup; add package-info.nvim |
| `lua/qol_mini.lua` | Add `<leader>n` group label |
| `lua/16_trouble.lua` | **New** — trouble.nvim (no new install needed, already in lock) |
| `nvim-pack-lock.json` | Cleaned automatically after `:PackDel` calls |
| `CHEATSHEET.md` | Add trouble keymaps, package-info keymaps; remove smear-cursor mention if any |

---

## Steps

### Phase 1 — Clean (reduce noise & startup cost)
- [ ] Delete `lua/__telescope.lua`
- [ ] Run `:PackDel` for the 11 orphaned plugins in §1b
- [ ] Remove smear-cursor setup from `qol.lua` + its MiniPick autocmd from `08_fuzzy_finder.lua`
- [ ] Run `:PackDel smear-cursor.nvim`
- [ ] Trim `06_colorscheme.lua`: remove everforest + tokyonight blocks
- [ ] Remove Python entries from `10_lsp.lua` (pyright, mason entries)
- [ ] Remove Python entries from `11_format.lua` (black, isort, pylint)

### Phase 2 — Add
- [ ] Create `lua/16_trouble.lua` — wire up trouble.nvim (already installed in lock)
- [ ] Add `package-info.nvim` to `qol.lua` with keymaps

### Phase 3 — Polish
- [ ] Add `<leader>n` group label to `qol_mini.lua`
- [ ] Update `CHEATSHEET.md` with new trouble + package-info keymaps

---

## Verification

```bash
# After changes, launch nvim and check:
:checkhealth           # no errors from removed plugins
:PackUpdate            # ensure remaining plugins are up-to-date
:Mason                 # verify no stale/orphaned entries

# Functional checks:
# 1. <leader>xd → trouble workspace diagnostics panel opens
# 2. Open package.json → virtual text shows npm package versions
# 3. Colorscheme: only gruvbox-material + kanagawa available
# 4. :lua require("smear_cursor") → should error (removed)
# 5. No Python LSP/format activity on .py files
```

---

## Resolved Decisions

| Question | Answer |
|---|---|
| Python stack | **Remove entirely** |
| Colorscheme | **gruvbox-material** primary, kanagawa alt — drop everforest + tokyonight |
| AI completion | **Keep Supermaven** |
| Debugger (nvim-dap) | **Skip** |
| Test runner (neotest) | **Skip** |
| HTTP client (kulala) | **Skip** |
| Treesitter extras | **Skip** |
| diffview.nvim | **Skip** — lazygit covers diffs; mini.git keymaps cover blame/history |
| trouble.nvim | **Wire it up** |
| smear-cursor.nvim | **Remove** |
