# nvim.minimal - Ultimate Minimal Neovim Configuration

A modular, minimal Neovim configuration for Neovim 0.12+ nightly that leverages native defaults and modern plugin APIs. Built on the philosophy that Neovim 0.12 nightly already has excellent defaults, so we only customize what truly needs customization.

## Philosophy

**Neovim 0.12 Nightly Has Good Defaults**: While 0.12 nightly has improved defaults, we still need some essentials like line numbers and signcolumn. This config uses mini.basics for common options/mappings/autocmds, then adds ~20 additional options for our specific needs.

**mini.basics Handles Common Patterns**: We use mini.basics with `basic=true` and `extra_ui=true` to set sensible defaults for options (number, signcolumn, breakindent, mouse, ignorecase/smartcase, list/listchars, pumblend, etc.), mappings (jk navigation, window movement, save shortcuts), and autocmds (yank highlight, cursor restore, etc.).

**Modular Structure**: Clean separation between config, core plugins, and optional extras:
- `init.lua` (54 lines) - Barebone bootstrap with Pack() helper
- `lua/config/` - Options, keymaps, autocmds
- `lua/plugins/` - Core plugins (always loaded)
- `lua/extras/` - Optional enhancements (toggle by commenting)

**Core is Complete**: Without any extras, you get a fully functional IDE with LSP, completion, TreeSitter, file explorer, fuzzy finding, and essential mini.nvim modules.

**Extras are Additive**: Each extra adds functionality but never conflicts with core. Toggle extras by commenting/uncommenting the `pcall(require, "extras.X")` lines in init.lua.

## Core Features

### What's Included Out of the Box

**LSP Integration** (lua/plugins/lsp.lua):
- Mason auto-installation for LSP servers
- Core servers: lua_ls (enhanced config), vtsls (TypeScript/JavaScript)
- Auto-completion, hover, code actions, rename, diagnostics
- Keymaps: K (hover), \<leader>ca (code action), \<leader>cr (rename), gd/gr (via picker)

**Completion** (lua/plugins/blink.lua):
- blink.cmp with fuzzy="lua" (fast Lua implementation)
- Sources: LSP, path, buffer, snippets (LuaSnip + friendly-snippets)
- Auto-brackets, signature help, documentation popups
- Rounded borders, scrollbar, max 10 items

**Syntax Highlighting** (lua/plugins/treesitter.lua):
- TreeSitter with auto-install
- Base parsers: lua, vim, vimdoc, query (more auto-installed as needed)
- Incremental selection: CR (expand), BS (shrink)

**Fuzzy Finding** (lua/plugins/snacks.lua):
- Snacks.nvim picker for files, buffers, grep
- Keymaps: \<leader>\<leader> (smart), \<leader>ff (files), \<leader>fb (buffers), \<leader>/ (grep)
- Integrated with LSP (gd/gr use picker)
- UI select integration

**File Management** (lua/plugins/oil.lua):
- oil.nvim for directory editing
- Keymap: - (open parent directory)
- Edit directories like buffers, delete to trash, skip confirms

**mini.nvim Modules** (lua/plugins/mini.lua):
- **mini.basics** - Options (number/signcolumn/breakindent/mouse/ignorecase/smartcase/list/listchars/pumblend/etc.), mappings (jk/save/windows), and autocmds (yank highlight, cursor restore, etc.)
- **mini.statusline** - Clean statusline
- **mini.ai** - TreeSitter text objects (af/if, ac/ic, ao/io, ab/ib, ak/ik, ap/ip)
- **mini.diff** - Git diff signs in signcolumn
- **mini.indentscope** - Indent guides and scope highlighting
- **mini.move** - Move lines/blocks with Alt+hjkl
- **mini.pairs** - Auto-pairs for brackets/quotes
- **mini.surround** - Surround text objects (sa/sd/sr/sf/sF/sh)
- **mini.trailspace** - Highlight and remove trailing whitespace

**Diagnostics** (lua/plugins/lsp.lua):
- Custom signs: 󰅚 (error), 󰀪 (warn), 󰌶 (hint),  (info)
- No virtual text (clean), underline enabled
- Keymaps: [d/]d (navigate), \<leader>cd (toggle)
- Rounded float borders

**Options** (lua/config/options.lua) - Only ~20 additional options beyond mini.basics:
- relativenumber=true (mini.basics only sets number)
- wrap=true, winborder=rounded, scrolloff=12
- inccommand=split (live preview)
- clipboard=unnamedplus (system clipboard)
- swapfile=false, textwidth=120
- pumheight=10
- shortmess+=WIcC
- spell=false (toggle with \\us), spelllang=en_us
- foldlevelstart=99, foldmethod=expr (TreeSitter)
- conceallevel=2
- autoformat=true

**Keymaps** (lua/config/keymaps.lua) - Essential keymaps only:
- Esc (clear search highlights)
- - (oil file explorer)
- \<leader>qq (quit all)
- H/L (prev/next buffer), J (last buffer)
- \<leader>bo (delete other buffers)
- [d/]d (diagnostics), \<leader>cd (toggle diagnostics)
- Cmd+S (save file in all modes)

**Autocmds** (lua/config/autocmds.lua):
- :Packsync command (update all plugins)
- All other autocmds handled by mini.basics

## Extras (Optional Enhancements)

Enable/disable extras by commenting the `pcall(require, "extras.X")` line in init.lua.

### extras.ai (GitHub Copilot)
**Plugins**: copilot.lua, blink-cmp-copilot

**Adds**:
- GitHub Copilot integration
- Copilot as blink.cmp source with  icon
- Priority score_offset=100
- Disabled for yaml, help, gitcommit, gitrebase

**Use Case**: AI-assisted coding with context-aware suggestions.

**Setup**: Run `:Copilot auth` after first load.

---

### extras.colorscheme (Gruvbox Material)
**Plugins**: gruvbox-material

**Adds**:
- Gruvbox Material colorscheme
- Medium background, material foreground
- Italics enabled, bold enabled
- Transparency level 2
- High UI contrast, bright floats

**Use Case**: Beautiful, warm color scheme (replaces default habamax).

---

### extras.conform (Code Formatting)
**Plugins**: conform.nvim

**Adds**:
- Format-on-save (toggle: \<leader>cf)
- :Format command (manual/range formatting)
- Formatters: prettier/prettierd (JS/TS/JSON/YAML/HTML/CSS), stylua (Lua), gofumpt+goimports (Go)
- Respects vim.g.autoformat flag

**Use Case**: Automatic code formatting with industry-standard formatters.

---

### extras.dev (Lua Development)
**Plugins**: lazydev.nvim

**Adds**:
- Enhanced Lua LSP for Neovim development
- Library definitions for vim.uv and 3rd party modules

**Use Case**: Writing Neovim plugins or configurations.

---

### extras.diagnostics (Inline Diagnostics)
**Plugins**: tiny-inline-diagnostic.nvim

**Adds**:
- Beautiful inline diagnostic messages with ghost text
- Shows source, icons, right-aligned
- Replaces default virtual text/float

**Use Case**: Prefer inline diagnostics over floating windows.

---

### extras.lsp-extended (More LSP Servers)
**Plugins**: None (uses mason-tool-installer)

**Adds**:
- Additional servers: gopls, eslint, html, tailwindcss, jsonls, yamlls, harper_ls
- Inlay hints toggle: \<leader>ih
- Language-specific configs (Go staticcheck, ESLint format, Harper spell check)

**Use Case**: Multi-language development beyond Lua/TypeScript.

---

### extras.misc (Better Escape + Which-Key)
**Plugins**: better-escape.nvim, which-key.nvim

**Adds**:
- jj/jk to escape insert mode (better-escape with default config)
- Which-key popup for keymap discovery

**Use Case**: Faster escape and keymap learning.

**Note**: Always enabled by default since better-escape is essential for vim-style workflow.

---

### extras.navigation (Flash Jump + Mini Surround)
**Plugins**: flash.nvim

**Adds**:
- Flash jump mode: \<leader>j (jump), \<leader>t (treesitter)
- Enhanced f/F/t/T with flash
- mini.surround already in core (sa/sd/sr/sf/sF/sh)

**Resolution**: Flash remapped to \<leader>j/t to avoid conflict with mini.surround's 's' key.

**Use Case**: Fast cursor navigation and text object manipulation.

---

### extras.picker (100+ Picker Keymaps)
**Plugins**: None (extends snacks.picker from core)

**Adds**:
- **Files** (\<leader>f): ff/fg/fr/fb/fc/fe
- **Search** (\<leader>s): sg/sw/sb/sl/ss/sS/sd/sD
- **LSP** (g): gd/gr/gD/gI/gy/gai/gao
- **Git** (\<leader>g): gs/gb/gl/gd/gf/gL/gS/gg
- **GitHub** (\<leader>gh): ghi/ghI/ghp/ghP/ghd (requires gh CLI)
- **Vim** (\<leader>s): sh/sm/sk/sc/sC/s//sa/sH/sn/sr/sj/sM/sp/si
- **Other** (\<leader>s/u): su/st/sq/sQ/sL/sT/sz/sR

**Use Case**: Comprehensive fuzzy finding for every workflow.

---

### extras.tools (Development Tools)
**Plugins**: vim-wakatime, live-preview.nvim, nvim-ts-autotag, lorem.nvim

**Adds**:
- WakaTime time tracking
- Live preview for HTML/Markdown
- Auto-close HTML/JSX tags
- Lorem ipsum generator

**Use Case**: Web development and productivity tracking.

---

### extras.ui (Visual Enhancements)
**Plugins**: smear-cursor.nvim, todo-comments.nvim

**Adds**:
- Smooth cursor animations (smear effect)
- TODO/FIXME/NOTE highlighting and picker

**Use Case**: Better visual feedback and task tracking.

---

## Installation

### Requirements

- **Neovim 0.12+ nightly** (required for native APIs)
- **Bob** (Neovim version manager) - recommended
- **Git**
- **A Nerd Font** (for icons)
- **gh CLI** (optional, for GitHub pickers in extras.picker)

### Setup

1. Set NVIM_APPNAME and launch with Bob nightly:
```bash
alias vi="NVIM_APPNAME=nvim.minimal bob run nightly"
vi
```

2. Plugins auto-install on first launch (wait ~30 seconds)

3. LSP servers auto-install via Mason when you open supported filetypes

4. For Copilot (if extras.ai enabled): `:Copilot auth`

## Customization

### Enabling/Disabling Extras

Edit `init.lua` lines 44-54:

```lua
pcall(require, "extras.conform")       -- Keep
-- pcall(require, "extras.ai")         -- Disable Copilot
pcall(require, "extras.colorscheme")   -- Keep
-- pcall(require, "extras.picker")     -- Disable 100+ keymaps
```

### Adding New Extras

Create `lua/extras/my-feature.lua`:

```lua
vim.pack.add({ "user/plugin" })

local ok, plugin = pcall(require, "plugin")
if ok then
  plugin.setup({ --[[ config ]] })
end
```

Add to init.lua:
```lua
pcall(require, "extras.my-feature")
```

### Adding LSP Servers

**Core servers** (edit `lua/plugins/lsp.lua:3`):
```lua
local servers = { "lua_ls", "vtsls", "pyright" }
```

**Extended servers** (edit `lua/extras/lsp-extended.lua:1`):
```lua
local extended_servers = {
  rust_analyzer = {},
  -- ...
}
```

### Customizing Keymaps

**Core keymaps**: Edit `lua/config/keymaps.lua`

**Picker keymaps**: Edit `lua/extras/picker.lua`

**Plugin keymaps**: Edit respective file in `lua/plugins/` or `lua/extras/`

### Modifying Options

Only add options that differ from Neovim 0.12 nightly defaults.

Edit `lua/config/options.lua`.

## Project Structure

```
nvim.minimal/
├── init.lua                   # Barebone bootstrap (54 lines)
├── lua/
│   ├── config/                # Core configuration
│   │   ├── options.lua        # Options (27 non-defaults)
│   │   ├── keymaps.lua        # Essential keymaps
│   │   └── autocmds.lua       # Packsync command
│   ├── plugins/               # Core plugins (always loaded)
│   │   ├── blink.lua          # Completion
│   │   ├── lsp.lua            # LSP + diagnostics
│   │   ├── mini.lua           # mini.nvim modules
│   │   ├── oil.lua            # File explorer
│   │   ├── snacks.lua         # Picker
│   │   └── treesitter.lua     # Syntax highlighting
│   └── extras/                # Optional enhancements
│       ├── ai.lua             # Copilot
│       ├── colorscheme.lua    # Gruvbox Material
│       ├── conform.lua        # Formatting
│       ├── dev.lua            # Lua development
│       ├── diagnostics.lua    # Inline diagnostics
│       ├── lsp-extended.lua   # More LSP servers
│       ├── misc.lua           # better-escape, which-key
│       ├── navigation.lua     # Flash jump
│       ├── picker.lua         # 100+ picker keymaps
│       ├── tools.lua          # wakatime, live-preview, autotag, lorem
│       └── ui.lua             # smear-cursor, todo-comments
├── snippets/                  # Custom snippets (LuaSnip format)
├── spell/                     # Custom spell files
└── AGENTS.md                  # This file
```

## Plugin List

### Core Plugins (11)
- nvim-mini/mini.nvim (10 modules)
- stevearc/oil.nvim
- neovim/nvim-lspconfig
- mason-org/mason.nvim
- mason-org/mason-lspconfig.nvim
- WhoIsSethDaniel/mason-tool-installer.nvim
- folke/snacks.nvim
- nvim-treesitter/nvim-treesitter
- L3MON4D3/LuaSnip
- rafamadriz/friendly-snippets
- saghen/blink.cmp

### Extra Plugins (16, all optional)
- zbirenbaum/copilot.lua (ai)
- giuxtaposition/blink-cmp-copilot (ai)
- sainnhe/gruvbox-material (colorscheme)
- stevearc/conform.nvim (conform)
- folke/lazydev.nvim (dev)
- rachartier/tiny-inline-diagnostic.nvim (diagnostics)
- max397574/better-escape.nvim (misc)
- folke/which-key.nvim (misc)
- folke/flash.nvim (navigation)
- wakatime/vim-wakatime (tools)
- brianhuster/live-preview.nvim (tools)
- windwp/nvim-ts-autotag (tools)
- derektata/lorem.nvim (tools)
- sphamba/smear-cursor.nvim (ui)
- folke/todo-comments.nvim (ui)

**Total**: 27 plugins (11 core + 16 extras)

## Key Insights for AI Agents

### Architecture Principles

1. **Use mini.basics for common options**: Enable `options.basic = true` and `options.extra_ui = true` to get sensible defaults (number, signcolumn, breakindent, mouse, ignorecase/smartcase, list/listchars, pumblend, etc.).

2. **Only set what mini.basics doesn't**: After enabling mini.basics, only set options that it doesn't cover (like relativenumber, wrap=true, scrolloff, textwidth, etc.).

3. **Modular Structure**: 
   - `config/` = settings (no plugins)
   - `plugins/` = always loaded (core IDE)
   - `extras/` = optional (pcall-guarded)

4. **Pack() Helper**: Simplifies plugin declarations. Accepts "user/repo" format and converts to full URLs.

5. **Error Handling**: All extras use `pcall()` to gracefully handle missing plugins.

6. **Native APIs**: Use `vim.lsp.config()` (not lspconfig.setup()), `vim.pack.add()` (not lazy.nvim), `vim.diagnostic.config()`, etc.

### Adding Features

**Core Feature** (always needed):
1. Add plugin to Pack() in init.lua
2. Create config in `lua/plugins/`
3. Require in init.lua after Pack()

**Optional Feature**:
1. Create `lua/extras/feature.lua`
2. Add `vim.pack.add()` in the extra file
3. Add `pcall(require, "extras.feature")` to init.lua

### Common Modifications

**Add LSP server**:
```lua
-- lua/plugins/lsp.lua:3 (core) or lua/extras/lsp-extended.lua:1 (extended)
local servers = { "lua_ls", "vtsls", "newserver" }
```

**Add formatter**:
```lua
-- lua/extras/conform.lua
formatters_by_ft = {
  rust = { "rustfmt" },
}
```

**Add picker keymap**:
```lua
-- lua/extras/picker.lua or lua/plugins/snacks.lua
map("n", "<leader>fn", picker("something"), { desc = "Find Something" })
```

**Change colorscheme**:
```lua
-- lua/extras/colorscheme.lua
vim.pack.add({ "user/theme" })
vim.cmd("colorscheme theme-name")
```

### Testing Changes

```bash
# Test with fresh state
rm -rf ~/.local/share/nvim.minimal ~/.local/state/nvim.minimal ~/.cache/nvim.minimal
NVIM_APPNAME=nvim.minimal bob run nightly

# Test with specific extra disabled
# Edit init.lua, comment out extra, then:
NVIM_APPNAME=nvim.minimal bob run nightly

# Check for errors
:checkhealth
:messages
```

### Important Notes

- **No lazy.nvim**: Uses native vim.pack APIs
- **No comments in code**: Keep code clean, document in AGENTS.md
- **Keymaps**: Always use `desc` field for discoverability
- **Capabilities**: Get from blink.cmp if available, else use protocol defaults
- **Conflict resolution**: Flash uses \<leader>j/t, mini.surround uses sa/sd/sr/sf/sF/sh

## Troubleshooting

**Plugins not installing**:
```vim
:messages  " Check for errors
:lua =vim.pack.get()  " List loaded plugins
```

**LSP not working**:
```vim
:LspInfo   " Check attached servers
:Mason     " Check installed servers
```

**Copilot not working**:
1. `:Copilot auth`
2. `:Copilot status`

**Keymaps not working**:
```vim
:map <leader>ff  " Check if keymap exists
:verbose map K   " Check what's mapped and where
```

**Performance issues**:
- Disable extras one by one to identify culprit
- Check `:Inspect` for plugin load times
- Run `:checkhealth` for diagnostics

## Credits

Built on excellent plugins:
- mini.nvim by @echasnovski
- snacks.nvim by @folke
- blink.cmp by @saghen
- oil.nvim by @stevearc
- conform.nvim by @stevearc
- Mason ecosystem
- nvim-treesitter
- And many others!

## License

Feel free to use, modify, and distribute this configuration as you see fit.
