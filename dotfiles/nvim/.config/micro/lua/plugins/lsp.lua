local servers = {
  html = {},
  cssls = {},
  tailwindcss = {},
  jsonls = {},
  vtsls = {
    typescript = { preferences = { importModuleSpecifier = "relative" } },
    typescriptreact = { preferences = { importModuleSpecifier = "relative" } },
    javascript = { preferences = { importModuleSpecifier = "relative" } },
    javascriptreact = { preferences = { importModuleSpecifier = "relative" } },
  },
  eslint = {
    workingDirectory = { mode = "auto" },
  },
  gopls = {
    gopls = {
      analyses = { unusedparams = true },
      staticcheck = true,
    },
  },
  lua_ls = {
    Lua = {
      workspace = { library = vim.api.nvim_get_runtime_file("lua", true) },
    },
  },
  harper_ls = {
    ["harper-ls"] = {
      linters = { SpellCheck = true },
      isolateToEnglish = true,
    },
  },
}

Pack({
  "mason-org/mason.nvim",
  "mason-org/mason-lspconfig.nvim",
  "neovim/nvim-lspconfig",
})

vim.lsp.config('*', {
  capabilities = vim.lsp.protocol.make_client_capabilities(),
})

require("mason").setup()
require("mason-lspconfig").setup({
  ensure_installed = vim.tbl_keys(servers),
  automatic_enable = true,
})

for server, settings in pairs(servers) do
  vim.lsp.config(server, { settings = settings })
end
