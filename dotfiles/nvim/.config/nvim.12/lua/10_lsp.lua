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

-- ── Diagnostic density toggle (verbose ↔ minimal) ────────────────────────────
local diagnostic_density = "verbose" -- start with signs + underline + inline
local function toggle_diagnostic_density()
	if diagnostic_density == "verbose" then
		diagnostic_density = "minimal"
		vim.diagnostic.config({
			virtual_text = false,
			signs = false,
			underline = false,
		})
		vim.notify("Diagnostics: minimal", vim.log.levels.INFO)
	else
		diagnostic_density = "verbose"
		vim.diagnostic.config({
			virtual_text = false,
			underline = true,
			signs = { text = {
				[vim.diagnostic.severity.ERROR] = " ",
				[vim.diagnostic.severity.WARN] = " ",
				[vim.diagnostic.severity.INFO] = " ",
				[vim.diagnostic.severity.HINT] = " ",
			}},
		})
		vim.notify("Diagnostics: verbose", vim.log.levels.INFO)
	end
end
vim.keymap.set("n", "<leader>td", toggle_diagnostic_density, { silent = true, desc = "Toggle diagnostic density" })

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
		"bashls",
		"harper_ls",
		"sqls",
		"emmet-language-server",
		"prettier",
		"eslint_d",
		"stylua",
		"shfmt",
		"gofumpt",
		"goimports",
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
	bashls = {},
	["emmet-language-server"] = {
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

-- Ensure spell file exists for harper_ls
local spell_file = vim.fn.stdpath("config") .. "/spell/en.utf-8.add"
local spell_dir = vim.fn.fnamemodify(spell_file, ":h")
if vim.fn.isdirectory(spell_dir) == 0 then
	vim.fn.mkdir(spell_dir, "p")
end
if vim.fn.filereadable(spell_file) == 0 then
	vim.fn.writefile({}, spell_file)
end

for name, config in pairs(servers) do
	config.capabilities = capabilities
	local ok = pcall(vim.lsp.config, name, config)
	if not ok then
		vim.notify("Failed to configure LSP: " .. name, vim.log.levels.ERROR)
		goto continue
	end
	local enable_ok = pcall(vim.lsp.enable, name)
	if not enable_ok then
		vim.notify("Failed to enable LSP: " .. name, vim.log.levels.ERROR)
	end
	::continue::
end

vim.api.nvim_create_autocmd("LspAttach", {
	group = vim.api.nvim_create_augroup("lsp_maps", { clear = true }),
	callback = function(ev)
		local function map(lhs, rhs, desc)
			vim.keymap.set("n", lhs, rhs, { buffer = ev.buf, silent = true, desc = desc })
		end

		-- ── Navigation ────────────────────────────────────────────────────────────
		map("gr", vim.lsp.buf.definition, "Goto definition")
		map("gR", vim.lsp.buf.references, "Find references")
		map("gy", vim.lsp.buf.type_definition, "Goto type definition")
		map("gi", vim.lsp.buf.implementation, "Goto implementation")

		-- ── Edit ──────────────────────────────────────────────────────────────────
		map("<leader>rn", vim.lsp.buf.rename, "Rename symbol")
		map("<leader>ca", vim.lsp.buf.code_action, "Code actions")
		map("<leader>f", function()
			require("conform").format({ async = true, lsp_format = "fallback" })
		end, "Format buffer")

		-- ── Info ──────────────────────────────────────────────────────────────────
		map("K", vim.lsp.buf.hover, "Hover documentation")
		map("<C-k>", vim.lsp.buf.signature_help, "Signature help")
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
