vim.pack.add({
	"https://github.com/stevearc/conform.nvim",
	"https://github.com/mfussenegger/nvim-lint",
})

local conform = require("conform")

conform.setup({
	formatters_by_ft = {
		javascript = { "prettier" },
		typescript = { "prettier" },
		javascriptreact = { "prettier" },
		typescriptreact = { "prettier" },
		svelte = { "prettier" },
		css = { "prettier" },
		html = { "prettier" },
		json = { "prettier" },
		yaml = { "prettier" },
		markdown = { "prettier" },
		graphql = { "prettier" },
		liquid = { "prettier" },
		lua = { "stylua" },
		go = { "goimports", "gofumpt" },
		sh = { "shfmt" },
		bash = { "shfmt" },
	},
	format_after_save = function(bufnr)
		-- Skip unmodifiable buffers and special filetypes
		if not vim.bo[bufnr].modifiable or vim.bo[bufnr].filetype == "" then
			return nil
		end
		return { lsp_format = "fallback", async = true, timeout_ms = 1000 }
	end,
})

local lint = require("lint")

lint.linters_by_ft = {
	typescript = { "eslint_d" },
	javascript = { "eslint_d" },
	svelte = { "eslint_d" },
	typescriptreact = { "eslint_d" },
	javascriptreact = { "eslint_d" },
	css = { "stylelint" },
}

-- BufReadPost removed: linting every buffer open causes lag when switching buffers
vim.api.nvim_create_autocmd({ "BufWritePost", "InsertLeave" }, {
	group = vim.api.nvim_create_augroup("lint", { clear = true }),
	callback = function()
		lint.try_lint(lint.linters_by_ft[vim.bo.filetype])
	end,
})
