-- Miscellaneous Plugins Configuration

vim.pack.add({
	"folke/todo-comments.nvim",
	"wakatime/vim-wakatime",
}, { confirm = false })

-- Todo Comments
-- Reference: :help todo-comments
require("todo-comments").setup({})

-- Wakatime (no configuration needed, works automatically)
-- Reference: https://wakatime.com/nvim
