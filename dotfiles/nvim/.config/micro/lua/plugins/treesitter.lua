-- Treesitter Configuration
-- Reference: :help nvim-treesitter

vim.pack.add({ "nvim-treesitter/nvim-treesitter" }, { confirm = false })

require("nvim-treesitter.configs").setup({
	ensure_installed = {
		-- Web tech
		"javascript",
		"typescript",
		"tsx",
		"jsx",
		"html",
		"css",
		"scss",
		"json",
		"yaml",
		"toml",
		"markdown",
		"markdown_inline",
		-- Go
		"go",
		"gomod",
		"gosum",
		"gowork",
		-- Lua & config
		"lua",
		"vim",
		"vimdoc",
		-- Utilities
		"bash",
		"regex",
	},
	sync_install = false, -- Don't block startup
	auto_install = true,
	modules = {},
	ignore_install = {},

	highlight = {
		enable = true,
	},

	indent = {
		enable = true,
	},

	incremental_selection = {
		enable = true,
		keymaps = {
			init_selection = "<CR>",
			node_incremental = "<CR>",
			node_decremental = "<BS>",
			scope_incremental = false,
		},
	},
})
