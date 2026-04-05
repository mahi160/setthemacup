-- LSP Configuration
-- Reference: :help lsp, :help vim.lsp.config
-- In Neovim 0.12+, use vim.lsp.config() + vim.lsp.enable()

vim.pack.add({
	"neovim/nvim-lspconfig",
	"mason-org/mason.nvim",
	"mason-org/mason-lspconfig.nvim",
}, { confirm = false })

local servers = {
	html = {},
	cssls = {},
	tailwindcss = {},
	jsonls = {},
	vtsls = {
		settings = {
			typescript = { preferences = { importModuleSpecifier = "relative" } },
			typescriptreact = { preferences = { importModuleSpecifier = "relative" } },
			javascript = { preferences = { importModuleSpecifier = "relative" } },
			javascriptreact = { preferences = { importModuleSpecifier = "relative" } },
		},
	},
	eslint = {
		settings = {
			workingDirectory = { mode = "auto" },
		},
	},
	gopls = {
		settings = {
			gopls = {
				analyses = { unusedparams = true },
				staticcheck = true,
			},
		},
	},
	lua_ls = {
		settings = {
			Lua = {
				workspace = { library = vim.api.nvim_get_runtime_file("lua", true) },
			},
		},
	},
	harper_ls = {
		settings = {
			["harper-ls"] = {
				linters = { SpellCheck = true },
				isolateToEnglish = true,
			},
		},
	},
}

-- Setup Mason
require("mason").setup()
require("mason-lspconfig").setup({
	ensure_installed = vim.tbl_keys(servers),
	automatic_enable = true,
})

-- Configure LSP servers
-- Reference: :help vim.lsp.config
for server_name, config in pairs(servers) do
	vim.lsp.config(server_name, config)
end

-- Enable all configured servers
for server_name in pairs(servers) do
	vim.lsp.enable(server_name)
end

-- Global LSP configuration
vim.lsp.config("*", {
	capabilities = vim.lsp.protocol.make_client_capabilities(),
})
