Pack({
	"rachartier/tiny-inline-diagnostic.nvim",
	"folke/todo-comments.nvim",
	"stevearc/quicker.nvim",
})

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

require("todo-comments").setup()

require("quicker").setup({
	keys = {
		{
			">",
			function()
				require("quicker").expand({ before = 2, after = 2, add_to_existing = true })
			end,
			desc = "Expand quickfix context",
		},
		{
			"<",
			function()
				require("quicker").collapse()
			end,
			desc = "Collapse quickfix context",
		},
	},
})
vim.keymap.set("n", "<leader>xx", function()
	require("quicker").toggle()
end, {
	desc = "Toggle quickfix",
})
