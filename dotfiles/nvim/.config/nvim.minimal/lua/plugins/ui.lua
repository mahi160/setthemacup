-- UI diagnostics, quickfix, and visual feedback
Pack({
	"rachartier/tiny-inline-diagnostic.nvim", -- inline diagnostic display
	"folke/todo-comments.nvim", -- highlight TODO, FIXME comments
	"stevearc/quicker.nvim", -- enhanced quickfix list
})

-- inline diagnostics: ghost-style error display
require("tiny-inline-diagnostic").setup({
	preset = "ghost",
})
vim.diagnostic.config({
	virtual_text = false,
	signs = {
		text = {
			[vim.diagnostic.severity.ERROR] = " ",
			[vim.diagnostic.severity.WARN] = " ",
			[vim.diagnostic.severity.INFO] = " ",
			[vim.diagnostic.severity.HINT] = " ",
		},
	},
})

-- todo comments: syntax highlighting for comments
require("todo-comments").setup()

-- quicker: improved quickfix experience
require("quicker").setup()
