-- Colorscheme Setup
-- Reference: :help colorscheme

vim.pack.add({ "sainnhe/everforest" }, { confirm = false })

vim.g.everforest_enable_italic = 1
vim.g.everforest_better_performance = 1
vim.g.everforest_background = "hard"
vim.g.everforest_transparent_background = 2

vim.cmd.colorscheme("everforest")
