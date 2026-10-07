vim.pack.add({
	"https://github.com/sainnhe/gruvbox-material",
	"https://github.com/rebelot/kanagawa.nvim",
	"https://github.com/sainnhe/everforest",
})

vim.g.gruvbox_material_enable_italic = 1
vim.g.gruvbox_material_better_performance = 1
vim.g.gruvbox_material_background = "hard"
vim.g.gruvbox_material_transparent_background = 2

vim.g.everforest_enable_italic = 1
vim.g.everforest_better_performance = 1
vim.g.everforest_background = "hard"
vim.g.everforest_transparent_background = 2

require("kanagawa").setup({
	theme = "wave",
	undercurl = true,
	transparent = true,
	commentStyle = { italic = true },
	functionStyle = { italic = true },
	keywordStyle = { italic = true },
	statementStyle = { italic = true },
	typeStyle = { italic = true },
	variablebuiltinStyle = { italic = true },
	specialReturn = true,
	specialException = true,
	blend = true,
	disableItalicComment = true,
	colors = {
		theme = { all = { ui = { bg_gutter = "none" } } },
	},
})

-- ~/.config/theme: written by scripts/toggle-theme.sh
local f = io.open(vim.env.HOME .. "/.config/theme")
local active = f and vim.trim(f:read("*a")) or "kanagawa-wave"
if f then f:close() end
vim.cmd.colorscheme(({ gruvbox = "gruvbox-material", everforest = "everforest" })[active] or "kanagawa")
