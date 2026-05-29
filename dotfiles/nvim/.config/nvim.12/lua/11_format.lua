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
		python = { "isort", "black" },
		go = { "goimports", "gofumpt" },
		sh = { "shfmt" },
		bash = { "shfmt" },
	},
	format_on_save = { lsp_format = "fallback", async = true, timeout_ms = 1000 },
})

local lint = require("lint")

lint.linters_by_ft = {
	python             = { "pylint" },
	typescript         = { "eslint_d", "oxlint" }, -- oxlint: 50-100x faster, catches different issues
	javascript         = { "eslint_d", "oxlint" },
	svelte             = { "eslint_d", "oxlint" },
	typescriptreact    = { "eslint_d", "oxlint" },
	javascriptreact    = { "eslint_d", "oxlint" },
	css                = { "stylelint" },
}

-- BufReadPost removed: linting every buffer open causes lag when switching buffers
vim.api.nvim_create_autocmd({ "BufWritePost", "InsertLeave" }, {
	group = vim.api.nvim_create_augroup("lint", { clear = true }),
	callback = function()
		lint.try_lint(lint.linters_by_ft[vim.bo.filetype])
	end,
})
