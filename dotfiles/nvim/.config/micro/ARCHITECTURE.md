# Configuration Architecture

## Startup Flow

```
nvim starts
   ↓
init.lua
   ├─→ require("config.options")      [vim settings]
   ├─→ require("config.keymaps")      [keybindings]
   ├─→ require("config.autocmds")     [autocommands]
   └─→ require("config.plugins")      [plugin orchestration]
         ├─→ vim.pack.add()           [install plugins]
         └─→ vim.defer_fn()           [wait & load plugins]
               ├─→ plugins/colorscheme.lua
               ├─→ plugins/lsp.lua        ⭐ Mason + LSP servers
               ├─→ plugins/treesitter.lua ⭐ Syntax highlighting
               ├─→ plugins/telescope.lua  ⭐ Fuzzy finder
               ├─→ plugins/oil.lua
               ├─→ plugins/mini.lua
               ├─→ plugins/diagnostics.lua
               ├─→ plugins/ai.lua
               └─→ plugins/misc.lua
```

## File Organization

```
.config/micro/
├── init.lua
├── README.md                    ← START HERE
├── REFACTOR_SUMMARY.md          ← Read this for technical details
├── spell/
│   └── en.utf-8.add
└── lua/
    ├── config/
    │   ├── options.lua          [12 lines]   Editor settings
    │   ├── keymaps.lua          [14 lines]   Keybindings
    │   ├── autocmds.lua         [22 lines]   Autocommands
    │   └── plugins.lua          [82 lines]   Plugin manager (NEW!)
    │
    └── plugins/
        ├── colorscheme.lua      [8 lines]    everforest theme
        ├── lsp.lua              [52 lines]   Language servers
        ├── treesitter.lua       [47 lines]   Syntax trees
        ├── telescope.lua        [109 lines]  Fuzzy finder
        ├── oil.lua              [12 lines]   File explorer
        ├── mini.lua             [13 lines]   Mini utilities
        ├── diagnostics.lua      [18 lines]   Error display
        ├── ai.lua               [4 lines]    AI completion
        └── misc.lua             [7 lines]    Other plugins
```

## Key Dependencies

```
Startup Dependencies:
  options.lua
    ↓
  keymaps.lua
    ↓
  autocmds.lua
    ↓
  plugins.lua
    ├─→ vim.pack.add()              [async]
    └─→ vim.defer_fn(retry_logic)   [waits for plugins]
          ├─→ colorscheme.lua       [no deps]
          ├─→ lsp.lua               [needs: mason, nvim-lspconfig]
          ├─→ treesitter.lua        [needs: nvim-treesitter]
          ├─→ telescope.lua         [needs: plenary, telescope.nvim]
          ├─→ oil.lua               [no deps]
          ├─→ mini.lua              [needs: mini.nvim]
          ├─→ diagnostics.lua       [needs: tiny-inline-diagnostic]
          ├─→ ai.lua                [needs: supermaven-nvim]
          └─→ misc.lua              [needs: todo-comments, vim-wakatime]
```

## Plugin Loading Order

The plugins load in this specific order to satisfy dependencies:

```
1. colorscheme       [loads everforest theme first]
2. lsp               [requires mason, lspconfig]
3. treesitter        [requires nvim-treesitter]
4. telescope         [requires plenary, telescope]
5. oil               [independent]
6. mini              [requires mini.nvim]
7. diagnostics       [independent, uses vim.diagnostic.config]
8. ai                [requires supermaven-nvim]
9. misc              [requires todo-comments, vim-wakatime]
```

## How Plugins Get Installed

```
1. User launches nvim
   ↓
2. init.lua → config.plugins
   ↓
3. vim.pack.add({all_plugins})
   [Downloads to ~/.local/share/micro/site/pack/core/opt/]
   [Non-blocking, happens in background]
   ↓
4. vim.defer_fn(setup_plugins, 100)
   [Wait 100ms for first plugin to extract]
   ↓
5. setup_plugins_with_retry()
   • Check if lspconfig is extracted (sign plugins are ready)
   • If not ready, retry (up to 10 times)
   • Once ready, load each plugin file with pcall()
   ↓
6. Each plugin:require()s and configures itself
   [If load fails, error shown via vim.notify()]
```

## Error Handling

```
Config Load Failures:
  ├─→ Shown in :messages
  ├─→ Also displayed as vim.notify() popup
  └─→ Non-fatal (editor still works)

Plugin Load Failures:
  ├─→ Wrapped in pcall() → error caught
  ├─→ Error logged to vim.notify()
  ├─→ Other plugins continue loading
  └─→ Check :messages for details

Retry Logic:
  ├─→ Waits up to 100ms for plugins to extract
  ├─→ Retries up to 10 times if not ready
  ├─→ Gives up gracefully with warning
  └─→ Never blocks startup
```

## Configuration Points

### To Add New Options
Edit: `lua/config/options.lua`
```lua
vim.opt.your_option = value
```

### To Add New Keybindings
Edit: `lua/config/keymaps.lua`
```lua
keymap("n", "<leader>x", "<cmd>YourCommand<cr>", { desc = "Description" })
```

### To Add New Plugin
Create: `lua/plugins/your_plugin.lua`
Add to install list in: `lua/config/plugins.lua` → `install_plugins{}`
Add to load order in: `lua/config/plugins.lua` → `load_order{}`

### To Configure LSP Server
Edit: `lua/plugins/lsp.lua` → `servers` table:
```lua
local servers = {
  rust_analyzer = { settings = { ... } },
  -- ... add your server
}
```

## Troubleshooting Guide

### Config won't load?
```lua
NVIM_APPNAME=micro nvim -V1   -- Enable verbose logging
:messages                       -- Check error messages
```

### Plugin fails to load?
```lua
:lua print(vim.inspect(package.loaded.plugins))  -- Check what's loaded
:Mason                                            -- Install missing servers
:TSInstall <language>                             -- Install treesitter parser
```

### LSP not working?
```lua
:LspInfo                        -- Check LSP status
:Mason                          -- Install language servers
```

### Slow startup?
```bash
# Compile FZF native
cd ~/.local/share/micro/site/pack/core/opt/telescope-fzf-native.nvim
make
```

---

## Performance Characteristics

| Phase | Duration | Notes |
|-------|----------|-------|
| init.lua loads | < 10ms | Just requires config modules |
| Options apply | < 1ms | Simple table operations |
| Keymaps register | < 2ms | Just keymap.set calls |
| Autocmds setup | < 1ms | Just event registration |
| vim.pack.add | async | Downloads in background |
| defer_fn wait | 100ms | Waits for plugin extraction |
| Plugin loading | ~200-500ms | Depends on plugin count |
| **Total startup** | **~1-2s** | On first run with install |
| **Total startup** | **~500ms** | On subsequent runs |

---

## Vim Patch Compatibility

✅ Neovim 0.12+
✅ Lua 5.1 compatible
✅ Uses vim.pack (native, no external plugin manager)
✅ Uses vim.lsp.config() (nvim 0.12+ pattern)
✅ Compatible with LSPConfig 0.1.6+

---

**This architecture prioritizes:**
- 🚀 Fast startup
- 🧩 Easy maintenance
- 🔧 Clear modularity
- 📝 Good documentation
- 🛡️ Robust error handling
