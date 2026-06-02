-- Run once: :luafile ~/.config/nvim.12/cleanup-orphans.lua
-- Deletes orphaned plugins that are in the lock file but no longer used.
-- Safe to re-run. Delete this file after running.

local orphans = {
	"LuaSnip",
	"better-escape.nvim",
	"fzf-lua",
	"monokai-pro.nvim",
	"plenary.nvim",
	"telescope.nvim",
	"telescope-fzf-native.nvim",
	"telescope-ui-select.nvim",
	"tiny-cmdline.nvim",
	"which-key.nvim",
	"nvim-web-devicons",
	"smear-cursor.nvim",
	"everforest",
	"tokyonight.nvim",
}

vim.notify("Cleaning " .. #orphans .. " orphaned plugins…", vim.log.levels.INFO)
vim.pack.del(orphans)
vim.notify("Done. Delete ~/.config/nvim.12/cleanup-orphans.lua when finished.", vim.log.levels.INFO)
