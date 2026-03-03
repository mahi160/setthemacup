-- LSP server configurations
local servers = {
  lua_ls = {
    Lua = { workspace = { library = vim.api.nvim_get_runtime_file("lua", true) } },
  },
  vtsls = {
    settings = {
      typescript = {
        inlayHints = {
          parameterNames = { enabled = "all" },
          parameterTypes = { enabled = true },
          variableTypes = { enabled = true },
          propertyDeclarationTypes = { enabled = true },
          functionLikeReturnTypes = { enabled = true },
        },
      },
    },
  },
  eslint = {
    settings = {
      workingDirectories = { mode = "auto" },
      format = true,
    },
  },
  gopls = {
    settings = {
      gopls = {
        analyses = {
          unusedparams = true,
          shadow = true,
        },
        staticcheck = true,
        gofumpt = true,
      },
    },
  },
  html = {},
  tailwindcss = {},
  jsonls = {},
  yamlls = {},
  harper_ls = {
    settings = {
      ["harper-ls"] = {
        linters = {
          SpellCheck = true,
        },
        isolateToEnglish = true,
      },
    },
  },
}

-- LSP keymaps
local keymaps = {
  { "n", "gd", vim.lsp.buf.definition, { desc = "Goto Definition" } },
  { "n", "gr", vim.lsp.buf.references, { desc = "References" } },
  { "n", "<leader>ca", vim.lsp.buf.code_action, { desc = "Code Action" } },
  { "n", "<leader>cr", vim.lsp.buf.rename, { desc = "Rename" } },
  { "n", "<leader>ih", function()
    vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
  end, { desc = "Toggle Inlay Hints" } },
}

local function setup_keymaps(bufnr)
  for _, map in ipairs(keymaps) do
    local mode, lhs, rhs, opts = map[1], map[2], map[3], map[4]
    opts.buffer = bufnr
    vim.keymap.set(mode, lhs, rhs, opts)
  end
end

-- Capabilities
local capabilities = vim.lsp.protocol.make_client_capabilities()
capabilities.textDocument.completion.completionItem.snippetSupport = true

-- Install LSP servers
require("mason-tool-installer").setup({
  ensure_installed = vim.tbl_keys(servers)
})

-- Configure LSP servers
for server, config in pairs(servers) do
  vim.lsp.config(server, {
    settings = config,
    capabilities = capabilities,
    on_attach = function(_, bufnr)
      setup_keymaps(bufnr)
    end,
  })
end

-- LSP UI improvements
vim.lsp.handlers["textDocument/hover"] = vim.lsp.with(
  vim.lsp.handlers.hover,
  { border = "rounded" }
)

vim.lsp.handlers["textDocument/signatureHelp"] = vim.lsp.with(
  vim.lsp.handlers.signature_help,
  { border = "rounded" }
)
