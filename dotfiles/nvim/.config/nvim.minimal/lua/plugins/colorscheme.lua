-- Color schemes and themes
vim.pack.add({
	"https://github.com/sainnhe/sonokai", -- dark theme with multiple variants
	"https://github.com/sainnhe/everforest", -- green-tinted dark theme
}, { confirm = false })

-- sonokai: modern dark theme
vim.g.sonokai_enable_italic = 1
vim.g.sonokai_better_performance = 1
vim.g.sonokai_background = "hard"
vim.g.sonokai_transparent_background = 2

-- everforest: forest-inspired theme
vim.g.everforest_enable_italic = 1
vim.g.everforest_better_performance = 1
vim.g.everforest_background = "hard"
vim.g.everforest_transparent_background = 2
vim.cmd("colorscheme everforest")