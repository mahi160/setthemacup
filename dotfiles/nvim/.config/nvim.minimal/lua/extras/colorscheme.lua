vim.pack.add({
	"https://github.com/sainnhe/gruvbox-material",
	"https://github.com/sainnhe/everforest",
	"https://github.com/rebelot/kanagawa.nvim",
})

-- Gruvbox Material (existing configuration)
vim.g.gruvbox_material_background = "medium"
vim.g.gruvbox_material_foreground = "material"
vim.g.gruvbox_material_enable_italic = 1
vim.g.gruvbox_material_disable_italic_comment = 0
vim.g.gruvbox_material_enable_bold = 1
vim.g.gruvbox_material_transparent_background = 0
vim.g.gruvbox_material_diagnostic_text_highlight = 0
vim.g.gruvbox_material_diagnostic_line_highlight = 0
vim.g.gruvbox_material_diagnostic_virtual_text = "colored"
vim.g.gruvbox_material_sign_column_background = "none"
vim.g.gruvbox_material_ui_contrast = "high"
vim.g.gruvbox_material_float_style = "bright"
vim.g.gruvbox_material_statusline_style = "default"
vim.g.gruvbox_material_better_performance = 1

-- Everforest (soft variant for maximum eye comfort)
vim.g.everforest_background = "soft"
vim.g.everforest_enable_italic = 1
vim.g.everforest_disable_italic_comment = 0
vim.g.everforest_enable_bold = 1
vim.g.everforest_transparent_background = 2
vim.g.everforest_sign_column_background = "none"
vim.g.everforest_ui_contrast = "high"
vim.g.everforest_float_style = "bright"
vim.g.everforest_diagnostic_text_highlight = 0
vim.g.everforest_diagnostic_line_highlight = 0
vim.g.everforest_diagnostic_virtual_text = "colored"
vim.g.everforest_better_performance = 1

-- Kanagawa (WCAG 2.1 Level AA certified)
local ok, kanagawa = pcall(require, "kanagawa")
if ok then
	kanagawa.setup({
		compile = false,
		undercurl = true,
		commentStyle = { italic = true },
		functionStyle = {},
		keywordStyle = { italic = true },
		statementStyle = { bold = true },
		typeStyle = {},
		transparent = false,
		dimInactive = false,
		terminalColors = true,
		theme = "wave",
		background = {
			dark = "wave",
			light = "lotus",
		},
	})
end

-- Set default colorscheme
vim.cmd("colorscheme everforest")
