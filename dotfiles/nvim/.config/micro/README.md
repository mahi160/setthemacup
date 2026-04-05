# Neovim 0.12 Configuration

A clean, modular, industry-standard Neovim configuration with LSP, Treesitter, Telescope, and more.

## ✅ What's Fixed

Your config has been refactored to fix all compatibility issues with Neovim 0.12:

1. **Plugin Loading** - Fixed async race condition with proper defer_fn and retry logic
2. **LSP Setup** - Proper vim.lsp.config() pattern for nvim 0.12
3. **Deprecated APIs** - Replaced vim.loop.cwd() with vim.fn.getcwd()
4. **Treesitter** - Changed from blocking sync_install to non-blocking async install
5. **Code Quality** - Now follows industry-standard modular patterns

See `REFACTOR_SUMMARY.md` for detailed before/after comparison.

---

## 📁 Directory Structure

```
lua/
├── config/
│   ├── options.lua    # Editor settings (tabs, wrapping, etc.)
│   ├── keymaps.lua    # Keybindings
│   ├── autocmds.lua   # Autocommands (auto-format on save, etc.)
│   └── plugins.lua    # Plugin manager (install + load orchestration)
└── plugins/           # Individual plugin configurations
    ├── colorscheme.lua    # everforest theme
    ├── lsp.lua            # Language servers (Mason + LSP config)
    ├── treesitter.lua     # Syntax highlighting & text objects
    ├── telescope.lua      # Fuzzy finder
    ├── oil.lua            # File explorer
    ├── mini.lua           # Collection of mini plugins
    ├── diagnostics.lua    # Error/warning display
    ├── ai.lua             # AI completion (Supermaven)
    └── misc.lua           # Other utilities
```

---

## 🚀 Getting Started

### First Launch
```bash
NVIM_APPNAME=micro nvim
```

On first launch, plugins will be automatically downloaded and installed. This may take a minute.

### Prerequisites
- Neovim 0.12+
- ripgrep (`rg`) - for telescope grep
- git - for plugin installation
- node/npm - for some LSP servers (optional)

---

## 📝 Usage

### Navigation
- `-` - Open file explorer (Oil)
- `H` / `L` - Next/previous buffer
- `J` - Toggle last buffer
- `jj` - Escape insert mode

### Search (Telescope)
- `<leader><leader>` - Search files (Git-aware)
- `<leader>sf` - Search frecency (most used files)
- `<leader>sb` - Search buffers
- `<leader>/` - Live grep search
- `<leader>sk` - Search keymaps

### LSP (Built-in to Neovim 0.12)
After opening a file in a supported language:
- `gd` - Go to definition
- `gr` - Go to references
- `gi` - Go to implementation
- `gD` - Go to declaration
- `K` - Hover documentation
- `]d` - Next diagnostic
- `[d` - Previous diagnostic

### Formatting
- Auto-formats on save (if LSP server supports it)

---

## ⚙️ Configuration

### Change Editor Behavior
Edit `lua/config/options.lua`:
```lua
vim.opt.tabstop = 4         -- Change tab width
vim.opt.relativenumber = false  -- Disable relative line numbers
vim.opt.wrap = false        -- Disable text wrapping
```

### Add Custom Keymaps
Edit `lua/config/keymaps.lua`:
```lua
local keymap = vim.keymap.set
keymap("n", "<leader>w", "<cmd>w<cr>", { desc = "Save file" })
```

### Add Language Servers
Edit `lua/plugins/lsp.lua`, add to the `servers` table:
```lua
local servers = {
  -- ... existing servers
  rust_analyzer = {},  -- Rust
  pylsp = {},          -- Python
}
```

---

## 🔧 Post-Installation Setup (Optional)

### 1. Compile Telescope FZF for Better Performance
```bash
cd ~/.local/share/micro/site/pack/core/opt/telescope-fzf-native.nvim
make
```

### 2. Install Language Servers
Run `:Mason` in Neovim and install servers you need:
- `vtsls` - TypeScript/JavaScript
- `lua_ls` - Lua
- `gopls` - Go
- `tailwindcss` - Tailwind CSS
- etc.

### 3. Fix Treesitter (if having issues)
```bash
:TSUpdate
:TSInstall lua javascript typescript html css
```

---

## 🐛 Troubleshooting

### Plugins not loading
- Wait a few seconds on first launch for download/extraction
- Check `:messages` for error details

### LSP not attaching
1. Verify language server is installed: `:Mason`
2. Check file type is recognized: `:echo &filetype`
3. View LSP status: `:LspInfo`

### Treesitter not working
- Run `:TSInstall <language>` for your file type
- Run `:TSUpdate` to update all parsers

### Slow startup
- Compile FZF native (see above)
- Check if a plugin is failing: Look at `:messages`

---

## 📚 Help Commands

Access built-in help for any topic:
```
:help options        # Editor options
:help keymaps        # Keymap API
:help lsp            # LSP documentation
:help nvim-treesitter  # Treesitter docs
:help telescope      # Telescope docs
:help oil            # Oil.nvim docs
```

---

## 🔗 Plugin References

| Plugin | Purpose | Docs |
|--------|---------|------|
| nvim-lspconfig | Language server configuration | `:help lspconfig` |
| mason.nvim | Language server installer | `:help mason` |
| nvim-treesitter | Syntax highlighting | `:help nvim-treesitter` |
| telescope.nvim | Fuzzy finder | `:help telescope` |
| oil.nvim | File explorer | `:help oil` |
| mini.nvim | Mini utilities (pairs, surround, etc) | `:help mini` |
| everforest | Colorscheme | (vim.g settings in colorscheme.lua) |
| supermaven-nvim | AI completion | (auto-configured) |

---

## 📖 Learning Resources

- **Neovim**: https://neovim.io/doc/user/
- **Lua in Neovim**: `:help lua`
- **LSP**: `:help vim.lsp`
- **API**: `:help api`

---

## ⚡ Tips

1. **Search for help**: `:Telescope help_tags` to search all help topics
2. **View keymaps**: `:Telescope keymaps` to find any keymap
3. **Check config**: `:Telescope find_files cwd=~/.config/micro/lua` to browse config files
4. **View buffers**: `:Telescope buffers` to quickly switch between open files

---

## 🎯 Next Steps

1. ✅ Config is loaded and working!
2. 📦 (Optional) Run `:Mason` and install language servers you need
3. 🔧 Customize `lua/config/` files to your preferences
4. 📚 Read help files (`:help nvim-treesitter`, etc.) to learn features

---

**Happy coding!** 🚀

For issues or questions, check `:messages` for error details and `:LspInfo` for LSP status.
