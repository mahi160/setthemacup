-- Diagnostic Display Configuration
-- Reference: :help diagnostic

vim.pack.add({ "rachartier/tiny-inline-diagnostic.nvim" }, { confirm = false })

require("tiny-inline-diagnostic").setup({
	preset = "ghost",
})

-- Configure diagnostic signs and options
vim.diagnostic.config({
	virtual_text = false,
	signs = {
		text = {
			[vim.diagnostic.severity.ERROR] = " ",
			[vim.diagnostic.severity.WARN] = " ",
			[vim.diagnostic.severity.INFO] = " ",
			[vim.diagnostic.severity.HINT] = " ",
		},
	},
})
