Pack({ "sainnhe/everforest", "catppuccin/nvim"})

vim.g.everforest_enable_italic = 1
vim.g.everforest_better_performance = 1
vim.g.everforest_background = "hard"
vim.g.everforest_transparent_background = 2

require("catppuccin").setup({
	transparent_background = true,
	float = {
		transparent = true,
		solid = false,
		term_colors = true,
	},
})

vim.cmd("colorscheme everforest")
