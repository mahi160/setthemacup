---
description: Add a plugin to nvim.minimal config
agent: build
---

# Add Plugin to nvim.minimal Configuration

You will add a new plugin to the nvim.minimal configuration located at:
`~/Documents/Coding/Projects/setthemacup/dotfiles/nvim/.config/nvim.minimal/`

## Instructions

The user will provide either:
1. A plugin URL (e.g., `https://github.com/user/plugin-name`)
2. A GitHub short format (e.g., `user/plugin-name`)
3. Just a plugin name (assume it's from GitHub and try to find the correct repo)

## Steps to Follow

1. **Read AGENTS.md** at `~/Documents/Coding/Projects/setthemacup/dotfiles/nvim/.config/nvim.minimal/AGENTS.md` to understand the config architecture.

2. **Determine plugin type**:
   - **Core plugin** (always needed, fundamental to IDE): Add to init.lua Pack() call
   - **Optional plugin** (enhancement, optional feature): Create/update extras file

3. **For CORE plugins**:
   - Add plugin to the Pack() array in `init.lua` (lines 23-35)
   - Create or update config in `lua/plugins/plugin-name.lua`
   - Add require statement in `init.lua` after Pack() call (lines 37-42)
   - Follow existing patterns (use pcall for safety, setup with reasonable defaults)

4. **For OPTIONAL plugins** (most common):
   - Determine which extras category it belongs to:
     - `ai.lua` - AI/Copilot related
     - `colorscheme.lua` - Color schemes
     - `conform.lua` - Formatters
     - `dev.lua` - Development tools
     - `diagnostics.lua` - Diagnostic enhancements
     - `lsp-extended.lua` - Additional LSP servers
     - `misc.lua` - Utility plugins
     - `navigation.lua` - Navigation/movement
     - `picker.lua` - Picker/search keymaps
     - `tools.lua` - Development tools (wakatime, live-preview, etc.)
     - `ui.lua` - UI enhancements (cursor, todo-comments, etc.)
   - Create new extras file if none fit: `lua/extras/new-category.lua`
   - Add `vim.pack.add()` with plugin URL at top of extras file
   - Add plugin setup with pcall error handling
   - If new extras file created, add `pcall(require, "extras.new-category")` to init.lua

5. **Follow conventions**:
   - Always use full GitHub URLs in vim.pack.add()
   - Always wrap plugin requires in pcall for error handling
   - Add appropriate setup() calls with sensible defaults
   - Check for conflicts with existing plugins (especially keymaps)
   - Use rounded borders where applicable
   - Follow mini.basics pattern (don't duplicate functionality)

6. **Test the changes**:
   - Verify the config loads: `NVIM_APPNAME=nvim.minimal bob run nightly --headless -c "lua print('OK')" -c "quitall"`

7. **Provide summary**:
   - Which file(s) were modified
   - Whether it's a core or optional plugin
   - How to enable/disable if optional
   - Any keymaps or commands added
   - How to test: `NVIM_APPNAME=nvim.minimal bob run nightly`

## Important Notes

- **Read AGENTS.md first** to understand the architecture
- **Ask clarifying questions** if unsure whether plugin should be core or optional
- **Check for conflicts** with existing plugins (especially flash.nvim vs mini.surround style conflicts)
- **Use pcall everywhere** for safe error handling
- **Match existing code style** (spacing, indentation, structure)
- **Don't break existing functionality** - test before finalizing

## Example

User says: `/nvim-plug folke/trouble.nvim`

You should:
1. Read AGENTS.md to understand structure
2. Determine it's a UI/diagnostic plugin (optional)
3. Add to `lua/extras/ui.lua` (or create new extras/diagnostics-ui.lua)
4. Add vim.pack.add at top: `vim.pack.add({ "https://github.com/folke/trouble.nvim" })`
5. Add setup with pcall
6. Add pcall(require, "extras.ui") to init.lua if not already there
7. Test and summarize changes
