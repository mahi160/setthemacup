Pack("nvim-treesitter/nvim-treesitter")
require("nvim-treesitter.install").update("all")
require("nvim-treesitter.configs").setup({
	sync_install = true,
	modules = {},
	ignore_install = {},
	ensure_installed = {
		"lua",
		"go",
		"typescript",
	},
	auto_install = true, -- autoinstall languages that are not installed yet
	highlight = {
		enable = true,
	},
	indent = { enable = true },
	folds = { enable = true },
})
