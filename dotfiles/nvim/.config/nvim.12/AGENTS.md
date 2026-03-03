# nvim.12 - Modern Neovim IDE Configuration

A self-sufficient, kickstart-style Neovim configuration built for v0.12+ that works out-of-the-box as a complete IDE. The `init.lua` file provides everything you need for productive coding, while optional extras add enhancements for specific workflows.

## Philosophy

**Core is Complete**: The `init.lua` file (~200 lines) provides a fully functional IDE without requiring any extras. You can delete the entire `lua/extras/` directory and still have a working development environment.

**Extras are Enhancements**: Files in `lua/extras/` add optional features like AI assistance, custom themes, advanced keymaps, and UI polish. Each extra is independent and can be enabled/disabled by commenting out the corresponding `require()` line at the end of `init.lua`.

**Native v0.12 Features**: Built specifically for Neovim 0.12+, using native LSP configuration (`vim.lsp.config()`), native package management (`vim.pack.add()`), and modern plugin APIs.

## Core Features (init.lua)

### What's Included Out of the Box

- **LSP Integration**: Full Language Server Protocol support with Mason for auto-installation
  - Servers: `lua_ls`, `vtsls` (TypeScript/JavaScript)
  - Auto-completion, hover documentation, code actions, rename
  - Keymaps: `K` (hover), `gd` (definition), `gr` (references), `<leader>ca` (code action), `<leader>cr` (rename)

- **Completion**: `blink.cmp` with snippet support (LuaSnip + friendly-snippets)
  - LSP, path, buffer, and snippet sources
  - Auto-brackets, signature help, documentation popups

- **Diagnostics**: Built-in diagnostic configuration with navigation
  - Custom signs for errors/warnings/hints/info
  - Keymaps: `[d` (previous), `]d` (next), `<leader>cd` (toggle)

- **Syntax Highlighting**: TreeSitter with auto-install
  - Parsers: lua, vim, vimdoc, query (more auto-installed as needed)
  - Smart indentation and incremental selection

- **Fuzzy Finding**: Snacks.nvim picker for files, buffers, and grep
  - Keymaps: `<leader><leader>` (smart), `<leader>ff` (files), `<leader>fb` (buffers), `<leader>/` (grep)
  - Integrated with LSP (gd/gr use picker)

- **File Management**: oil.nvim for directory editing
  - Keymap: `-` (open parent directory)
  - Edit directories like buffers, delete to trash

- **UI Enhancements**:
  - `mini.statusline` - Clean statusline
  - `mini.ai` - TreeSitter-powered text objects (af/if for functions, ac/ic for classes, etc.)
  - `mini.animate` - Smooth scrolling and cursor animations
  - `mini.diff` - Git diff signs in signcolumn

- **Sensible Defaults**:
  - Relative line numbers, smart case search, system clipboard integration
  - No swap files, auto-save on buffer switch
  - Rounded borders, 120-char text width, persistent undo

## Extras (Optional Enhancements)

Each extra is a single file in `lua/extras/` that adds specific functionality. Enable/disable by commenting the `require()` line in `init.lua`.

### Available Extras

#### `ai.lua` - GitHub Copilot Integration
Adds AI-powered code completion via GitHub Copilot.

**Adds**:
- Copilot plugin installation and configuration
- Copilot as a completion source in blink.cmp (requires `completion.lua` extra)

**Use Case**: You want AI-assisted coding with context-aware suggestions.

---

#### `better-escape.lua` - Improved Escape Key
Use `jj` or `jk` to escape insert mode instead of reaching for `<Esc>`.

**Adds**:
- better-escape.nvim with default mappings
- Works in insert, command, terminal, visual, and select modes

**Use Case**: You prefer vim-style escape sequences for faster workflow.

---

#### `colorscheme.lua` - Gruvbox Material Theme
Beautiful, warm color scheme with material palette.

**Adds**:
- gruvbox-material colorscheme
- Configured with medium background, italic support, transparency

**Use Case**: You want a nicer color scheme than the default `habamax`.

---

#### `completion.lua` - Enhanced Completion UI + Copilot
Upgrades blink.cmp with better appearance and Copilot integration.

**Adds**:
- Copilot as a completion source (requires `ai.lua`)
- Custom Copilot icon in completion menu
- Enhanced appearance settings

**Use Case**: You enabled `ai.lua` and want Copilot suggestions in your completion menu.

---

#### `conform.lua` - Advanced Code Formatting
Professional code formatting with conform.nvim.

**Adds**:
- Format-on-save with toggle (`<leader>cf`)
- `:Format` command for manual formatting
- Formatters: prettier/prettierd (JS/TS/JSON/YAML/HTML/CSS), stylua (Lua), gofumpt/goimports (Go)

**Use Case**: You want automatic code formatting with industry-standard formatters.

---

#### `diagnostics.lua` - Fancy Inline Diagnostics
Beautiful inline diagnostic messages with ghost text.

**Adds**:
- tiny-inline-diagnostic.nvim plugin
- Inline diagnostic messages at end of line with ghost text style

**Use Case**: You prefer inline diagnostics over floating windows or virtual text.

---

#### `lsp.lua` - Extended LSP Servers + Inlay Hints
Adds more language servers and inlay hints support.

**Adds**:
- Additional servers: `gopls`, `eslint`, `html`, `tailwindcss`, `jsonls`, `yamlls`, `harper_ls`
- Inlay hints toggle: `<leader>ih`
- Language-specific configurations (Go staticcheck, TypeScript inlay hints, etc.)

**Use Case**: You work with multiple languages and want comprehensive LSP coverage.

---

#### `options.lua` - UI Polish
Additional visual enhancements for a polished experience.

**Adds**:
- Popup menu transparency (`pumblend`, `winblend`)
- Visible whitespace characters (tabs, trailing spaces, nbsp)
- Conceal level for cleaner syntax (hides markup in markdown, etc.)
- Virtual edit in visual block mode

**Use Case**: You want extra UI refinements and visual polish.

---

#### `picker.lua` - Extended Picker Keymaps
100+ additional keymaps for advanced fuzzy finding workflows.

**Adds**:
- **File pickers** (`<leader>f`): git files, recent files, config files, explorer
- **Search pickers** (`<leader>s`): grep word, grep buffers, buffer lines, symbols
- **LSP pickers** (g prefix): declarations, implementations, type definitions, call hierarchies
- **Git pickers** (`<leader>g`): status, branches, log, diff, stash
- **GitHub pickers** (`<leader>gh`): issues, PRs, PR diffs (requires gh CLI)
- **Vim pickers** (`<leader>s`): help, keymaps, commands, history, autocmds, highlights, etc.
- **Other**: undo history, treesitter symbols, quickfix, tags, spelling suggestions

**Use Case**: You want a comprehensive fuzzy finding system for every workflow.

---

## Installation

### Requirements

- **Neovim 0.12+** (nightly build required)
- **Bob** (Neovim version manager) - optional but recommended
- **Git**
- **A Nerd Font** (for icons)
- **gh CLI** (optional, for GitHub pickers in `picker.lua`)

### Setup

1. Clone or copy this config to your Neovim config directory:
```bash
# Using bob and NVIM_APPNAME
NVIM_APPNAME=nvim.12 bob run nightly

# Or set as default config
cp -r nvim.12 ~/.config/nvim
```

2. Launch Neovim - plugins will auto-install:
```bash
bob run nightly
```

3. Wait for plugins to install (check `:checkhealth` for any issues)

4. LSP servers will auto-install via Mason when you open supported filetypes

## Customization

### Enabling/Disabling Extras

Edit `init.lua` and comment out extras you don't want:

```lua
-- At the bottom of init.lua
pcall(require, "extras.conform")       -- Keep
-- pcall(require, "extras.ai")         -- Disable Copilot
pcall(require, "extras.colorscheme")   -- Keep
-- pcall(require, "extras.picker")     -- Disable 100+ keymaps
```

### Adding Your Own Extras

Create a new file in `lua/extras/`:

```lua
-- lua/extras/my-feature.lua
vim.pack.add("https://github.com/user/plugin")

local ok, plugin = pcall(require, "plugin")
if ok then
  plugin.setup({
    -- your config
  })
end
```

Then add to `init.lua`:
```lua
pcall(require, "extras.my-feature")
```

### Modifying Core Behavior

Edit `init.lua` directly. The file is organized into clear sections:
- Lines 1-34: Options
- Lines 36-47: Keymaps
- Lines 49-60: Plugin declarations
- Lines 62-80: TreeSitter
- Lines 82-115: LSP
- Lines 117-135: Diagnostics
- Lines 137-159: Completion
- Lines 161-181: Mini plugins
- Lines 183-188: Oil
- Lines 190-198: Snacks picker
- Lines 200-209: Load extras

### Adding More LSP Servers

**Core servers** (edit `init.lua`):
```lua
local servers = { "lua_ls", "vtsls", "pyright" }  -- Add pyright
```

**Extended servers** (edit `lua/extras/lsp.lua`):
```lua
local extended_servers = {
  -- ... existing servers ...
  rust_analyzer = {},  -- Add rust_analyzer
}
```

### Customizing Keymaps

All core keymaps are in `init.lua` lines 36-47. Picker keymaps are in `lua/extras/picker.lua`. Change them to your preference:

```lua
-- In init.lua
vim.keymap.set("n", "<leader>e", "<CMD>Oil<CR>", { desc = "File explorer" })  -- Change from "-"
```

## Project Structure

```
nvim.12/
├── init.lua                 # Self-sufficient core IDE (~200 lines)
├── lua/
│   └── extras/              # Optional enhancements
│       ├── ai.lua           # GitHub Copilot
│       ├── better-escape.lua # jj/jk escape
│       ├── colorscheme.lua  # Gruvbox Material
│       ├── completion.lua   # Enhanced blink.cmp + Copilot source
│       ├── conform.lua      # Code formatting
│       ├── diagnostics.lua  # Fancy inline diagnostics
│       ├── lsp.lua          # Extended LSP servers + inlay hints
│       ├── options.lua      # UI polish
│       └── picker.lua       # 100+ fuzzy finder keymaps
├── snippets/                # Custom snippets (LuaSnip format)
├── spell/                   # Custom spell files
└── AGENTS.md                # This file
```

## For AI Agents

### Architecture Principles

1. **Self-Sufficiency**: `init.lua` must always be a complete, working IDE. No external dependencies on extras.

2. **Extras are Additive**: Each extra adds functionality but never removes or conflicts with core. They should be independently toggleable.

3. **Plugin Declarations**: Plugins needed only for extras should be declared in the extra file itself using `vim.pack.add()`.

4. **Error Handling**: All extra requires use `pcall()` to gracefully handle missing plugins or errors.

5. **Minimal Core**: Keep `init.lua` minimal. Only essential IDE features belong in core. Everything else is an extra.

### Adding New Features

**Core Feature** (required for basic IDE functionality):
- Add to `init.lua`
- Add plugin to core plugin list
- Keep configuration minimal and general-purpose

**Optional Feature** (enhancement or specialty use):
- Create new file in `lua/extras/`
- Declare plugins with `vim.pack.add()` in the extra file
- Add `pcall(require, "extras.filename")` to end of `init.lua`
- Document in this file

### Conventions

- **No comments in code** - Keep code clean and self-documenting
- **Keymaps**: Use descriptive `desc` fields for all mappings
- **LSP**: Use `vim.lsp.config()` (native v0.12+ API)
- **Capabilities**: Always get capabilities from blink.cmp if available
- **Error handling**: Use `pcall()` for all plugin requires
- **Plugin URLs**: Always use full GitHub URLs in `vim.pack.add()`

### Testing Changes

```bash
# Test with fresh state
rm -rf ~/.local/share/nvim.12 ~/.local/state/nvim.12
NVIM_APPNAME=nvim.12 bob run nightly

# Test with specific extra disabled
# Edit init.lua, comment out the extra, then:
NVIM_APPNAME=nvim.12 bob run nightly

# Check for errors
:checkhealth
:messages
```

### Common Modifications

**Add LSP server to core**:
```lua
-- init.lua, line ~84
local servers = { "lua_ls", "vtsls", "newserver" }
```

**Add formatter to conform extra**:
```lua
-- lua/extras/conform.lua
formatters_by_ft = {
  rust = { "rustfmt" },  -- Add this
}
```

**Add picker keymap**:
```lua
-- lua/extras/picker.lua or init.lua
map("n", "<leader>fn", picker("something"), { desc = "Find Something" })
```

**Change colorscheme in extra**:
```lua
-- lua/extras/colorscheme.lua
vim.pack.add("https://github.com/user/theme")
vim.cmd("colorscheme theme-name")
```

## Troubleshooting

**Plugins not installing**:
```vim
:messages  " Check for errors
:Inspect   " Check plugin load status
```

**LSP not working**:
```vim
:LspInfo   " Check attached servers
:Mason     " Check installed servers
```

**Keymaps not working**:
```vim
:map <leader>ff  " Check if keymap exists
:verbose map K   " Check what's mapped and where
```

**Copilot not working**:
1. Ensure both `extras.ai` and `extras.completion` are loaded
2. Run `:Copilot auth` to authenticate
3. Check `:Copilot status`

## Credits

Built on top of excellent plugins:
- [mini.nvim](https://github.com/nvim-mini/mini.nvim) by @echasnovski
- [snacks.nvim](https://github.com/folke/snacks.nvim) by @folke
- [blink.cmp](https://github.com/saghen/blink.cmp) by @saghen
- [oil.nvim](https://github.com/stevearc/oil.nvim) by @stevearc
- [conform.nvim](https://github.com/stevearc/conform.nvim) by @stevearc
- [Mason](https://github.com/mason-org) ecosystem
- [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)
- And many others!

## License

Feel free to use, modify, and distribute this configuration as you see fit.
