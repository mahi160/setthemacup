# Neovim Cheatsheet

## Core Modes & Navigation

| Binding | Action |
|---------|--------|
| `jj` | Exit insert mode |
| `<Esc>` | Clear search highlight (normal mode) |
| `<C-h/j/k/l>` | Focus left/down/up/right window |
| `<C-d>` | Scroll down, cursor centered |
| `<C-u>` | Scroll up, cursor centered |
| `n` | Next search match, centered |
| `N` | Previous search match, centered |
| `-` | Open parent directory (oil.nvim) |

## Buffers & Windows

| Binding | Action |
|---------|--------|
| `<leader>\|` | Split vertically |
| `<leader>-` | Split horizontally |
| `<S-h>` | Previous buffer |
| `<S-l>` | Next buffer |
| `<S-j>` | Jump to last buffer |
| `<leader>bd` | Delete current buffer |
| `<leader>bo` | Close all other buffers |
| `<leader>qq` | Quit all buffers |
| `<leader>qs` | Save session for cwd |
| `<leader>ql` | Load session (local or latest) |
| `<leader>qd` | Delete session for cwd |
| `<leader>tu` | Toggle undo tree |

## Tabs (window layouts)

| Binding | Action |
|---------|--------|
| `gt` | Next tab |
| `gT` | Previous tab |
| `<leader>tn` | New tab |
| `<leader>tc` | Close current tab |
| `<leader>to` | Close all other tabs |

## Search & Navigation — mini.pick

| Binding | Action |
|---------|--------|
| `<leader><leader>` | Find file (frecency + all) |
| `<leader>/` | Grep in project (live) |
| `<leader>sb` | Switch buffer |
| `<leader>sg` | Search git-tracked files |
| `<leader>s.` | Recent files (oldfiles) |
| `<leader>sh` | Help tags |
| `<leader>sk` | Keymaps |
| `<leader>sd` | Diagnostics |
| `<leader>sc` | Commands |
| `<leader>sn` | Search nvim config |
| `<leader>sr` | Resume last search |
| `<Tab>` | Toggle file preview in picker |

## Editing & Text Manipulation

### Basic Edits
| Binding | Action |
|---------|--------|
| `<leader>d` (n,v) | Delete without yanking |
| `x p` | Paste over selection (no clobber) |
| `J` | Join lines, keep cursor |
| `v < / >` | Unindent/indent, keep selection |
| `gc / gcc` | Comment toggle (line/motion) |
| `<leader>y` (n,v) | Yank to clipboard |
| `<leader>p` (n,v) | Paste from clipboard |
| `<leader>P` (n,v) | Paste from clipboard (before) |

### Surround — mini.surround
| Binding | Action |
|---------|--------|
| `sa` | Add surrounding |
| `sd` | Delete surrounding |
| `sr` | Replace surrounding |
| `sf` | Find surrounding (right) |
| `sF` | Find surrounding (left) |
| `sh` | Highlight surrounding |
| `sn` | Update n_lines |
| `l / n` | Suffix for previous/next |

### Find & Replace
| Binding | Action |
|---------|--------|
| `<leader>r` | Find & replace (grug-far) |
| `<leader>sw` | Substitute word under cursor |

## Text Objects — mini.ai

These work with `v`, `d`, `c`, `y`:
- `f` = function, `c` = class, `o` = conditional, `l` = loop
- `a` = argument, `b` = block, `C` = comment

Examples: `daf` (delete function), `cil` (change inside loop), `vac` (select class)

## Language Server Protocol (LSP)

| Binding | Action |
|---------|--------|
| `K` | Hover docs (or `:help!` DWIM in non-LSP) |
| `gd` | Go to definition |
| `gr` | LSP references |
| `grn` | Rename symbol |
| `gra` | Code action |
| `gri` | Go to implementation |
| `grt` | Go to type definition |
| `grx` | Code lens |
| `gO` | Document symbols (outline) |
| `]d / [d` | Next/prev diagnostic |
| `<C-W>d` | Open diagnostic float |
| `<leader>f` | Format buffer (conform) |
| `<leader>ti` | Toggle inlay hints |

## Git — mini.git & mini.diff

| Binding | Action |
|---------|--------|
| `<leader>gh` | Show git history at cursor |
| `<leader>gb` | Show blame (vertical split) |
| `<leader>gl` | Show file log |
| `gh` | Apply (stage) hunk / hunk textobject |
| `gH` | Reset (discard) hunk |
| `]h / [h` | Next/prev hunk |
| `]H / [H` | Last/first hunk |

## Diagnostics & References — Trouble

| Binding | Action |
|---------|--------|
| `<leader>xd` | Workspace diagnostics (trouble) |
| `<leader>xD` | Buffer diagnostics (trouble) |
| `<leader>xr` | LSP references (trouble) |

## Quickfix & Loclist — quicker.nvim

| Binding | Action |
|---------|--------|
| `<leader>xx` | Toggle quickfix |
| `<leader>xl` | Toggle loclist |
| `]q / [q` | Next/prev quickfix |
| `]Q / [Q` | Last/first quickfix |
| `]l / [l` | Next/prev loclist |

## UI & Toggles

| Binding | Action |
|---------|--------|
| `<leader>tm` | Toggle minimap |
| `<leader>ti` | Toggle inlay hints |
| `<leader>du` | Toggle database UI |

## Live Preview & Utilities

| Binding | Action |
|---------|--------|
| `<leader>lo` | Start live HTML preview |
| `<leader>lc` | Close live preview |
| `<leader>X` | Make file executable (chmod +x) |
| `<leader>re` | Restart config |
| `<leader>?` | Open this cheatsheet |

## Completion & Snippets

- Menu appears automatically; press `<C-y>` to confirm
- `<Tab>` accepts supermaven AI ghost text (when menu closed)
- Signatures display inline as you type
- Snippets: **friendly-snippets** per language, expanded via **mini.snippets** + blink.cmp

## Spell Checking

- **harper_ls** runs on all files — checks spelling in comments, strings, and identifiers
- Severity: `hint` (subtle underline) — won't pollute error count
- `zg` — add word under cursor to personal dictionary
- `gra` — trigger harper code action to fix a spelling error
- Dictionary: `~/.config/nvim.12/spell/en.utf-8.add`

## npm / Package Info

| Binding | Action |
|---------|--------|
| `<leader>np` | Show npm package versions inline |
| `<leader>nu` | Update package on cursor line |
| `<leader>nd` | Delete package on cursor line |
| `<leader>ni` | Install a new package |

## Command Mode

| Command | Action |
|---------|--------|
| `:PackUpdate` | Update all plugins (vim.pack) |
| `:PackUpdate plugin1 plugin2` | Update specific plugins |
| `:PackDel plugin1 plugin2` | Delete unused plugins |
| `:messages` | Show startup messages |
| `:restart` | Restart config |

## Options

- `inccommand = "split"` — Live preview of `:s` substitutions
- To enable clipboard sync with system: uncomment `clipboard:append("unnamedplus")` in `01_core.lua`
- `relativenumber` auto-disables in insert mode, restores on leaving it

## Color Preview (colorpeek)

- Hold cursor on a `#rrggbb`, `#rgb`, `rgb()`, `hsl()`, or `oklch()` value → swatch + hex shown as virtual text (eol)
- Works in any buffer/filetype — not limited to LSPs with color-capability (`vim.lsp.document_color` still enabled separately)

## Sessions (mini.sessions)

- Local `Session.vim` per project cwd — autoloads on `nvim` with no file args, autosaves on quit
- `<leader>qs` save, `<leader>ql` load, `<leader>qd` delete (see Buffers & Windows)

---

## Tabs vs. Buffers

**Buffers** (`<S-h>/<S-l>`): Files in memory, flip between them quickly, all in same window.

**Tabs** (`gt`/`gT`): Separate window layouts, each can contain multiple buffers side-by-side.
Use tabs when organizing by feature/context (e.g., Tab 1=auth, Tab 2=ui, Tab 3=docs).

---

## Helper Keys (from mini.clue)

Press a prefix key to see all available sub-mappings:
- `<leader>` — all leader commands
- `g` — LSP + Neovim built-in
- `z` — folding, diff, etc.
- `[` / `]` — previous/next (buffers, quickfix, diagnostics, etc.)
- `"` / `'` — registers and marks
