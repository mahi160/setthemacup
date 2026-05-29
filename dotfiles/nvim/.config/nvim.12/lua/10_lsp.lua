vim.pack.add({
	"https://github.com/neovim/nvim-lspconfig",
	"https://github.com/mason-org/mason.nvim",
	"https://github.com/mason-org/mason-lspconfig.nvim",
	"https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim",
	"https://github.com/rachartier/tiny-inline-diagnostic.nvim",
})

vim.diagnostic.config({
	virtual_text = false,
	update_in_insert = false,
	severity_sort = true,
	underline = true,
	signs = {
		text = {
			[vim.diagnostic.severity.ERROR] = " ",
			[vim.diagnostic.severity.WARN] = " ",
			[vim.diagnostic.severity.INFO] = " ",
			[vim.diagnostic.severity.HINT] = " ",
		},
	},
	float = { border = "rounded", source = "if_many", focusable = false },
})

require("tiny-inline-diagnostic").setup({ preset = "ghost" })

-- virtual swatch style (■ colored block inline before the value)
vim.lsp.document_color.enable(true, nil, { style = "virtual" })
vim.lsp.linked_editing_range.enable()

require("mason").setup()
require("mason-lspconfig").setup()
require("mason-tool-installer").setup({
	ensure_installed = {
		"lua_ls",
		"vtsls",
		"svelte",
		"tailwindcss",
		"html",
		"cssls",
		"gopls",
		"pyright",
		"bashls",
		"harper_ls",
		"sqls",
		"emmet-language-server",
		"prettier",
		"eslint_d",
		"oxlint", -- fast Rust linter; wired in 11_format.lua alongside eslint_d
		"stylua",
		"shfmt",
		"gofumpt",
		"goimports",
		"black",
		"pylint",
		"isort",
		"stylelint",
		"stylelint_lsp",
	},
})

local capabilities = require("blink.cmp").get_lsp_capabilities()

local servers = {
	lua_ls = {
		settings = {
			Lua = {
				diagnostics = { globals = { "vim" } },
				workspace = { checkThirdParty = false },
				telemetry = { enable = false },
			},
		},
	},
	vtsls = {
		settings = {
			typescript = { preferences = { importModuleSpecifier = "relative" } },
			javascript = { preferences = { importModuleSpecifier = "relative" } },
		},
	},
	svelte = {},
	tailwindcss = {},
	html = {},
	cssls = {
		settings = {
			css = {
				validate = true,
				lint = {
					unknownAtRules = "ignore",
				},
			},
		},
	},
	sqls = {},
	pyright = {},
	bashls = {},
	emmet_language_server = {
		filetypes = { "html", "css", "javascriptreact", "typescriptreact", "svelte" },
	},
	gopls = {
		settings = {
			gopls = { gofumpt = true, staticcheck = true, usePlaceholders = true },
		},
	},
	harper_ls = {
		settings = {
			["harper-ls"] = {
				userDictPath = vim.fn.stdpath("config") .. "/spell/en.utf-8.add",
				diagnosticSeverity = "hint",
				codeActions = true,
			},
		},
	},
	stylelint_lsp = {
		settings = {
			stylelintplus = {
				autoFixOnSave = false,
				autoFixOnFormat = false,
			},
		},
	},
}

for name, config in pairs(servers) do
	config.capabilities = capabilities
	vim.lsp.config(name, config)
	vim.lsp.enable(name)
end

vim.api.nvim_create_autocmd("LspAttach", {
	group = vim.api.nvim_create_augroup("lsp_maps", { clear = true }),
	callback = function(ev)
		local function map(lhs, rhs, desc)
			vim.keymap.set("n", lhs, rhs, { buffer = ev.buf, silent = true, desc = desc })
		end

		map("<leader>ti", function()
			vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled({ bufnr = ev.buf }), { bufnr = ev.buf })
		end, "Toggle inlay hints")
	end,
})

-- vim.api.nvim_create_autocmd({ "BufEnter", "InsertLeave" }, {
-- 	group = vim.api.nvim_create_augroup("codelens", { clear = true }),
-- 	callback = function(ev)
-- 		if #vim.lsp.get_clients({ bufnr = ev.buf }) > 0 then
-- 			vim.lsp.codelens.enable(true, { bufnr = ev.buf })
-- 		end
-- 	end,
-- })
