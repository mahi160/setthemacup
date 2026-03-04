require("mason").setup()
require("mason-lspconfig").setup({ automatic_installation = true })

local servers = { "lua_ls", "vtsls" }

local lsp_keymaps = {
  { "n", "K", vim.lsp.buf.hover, { desc = "Hover" } },
  { "n", "<leader>ca", vim.lsp.buf.code_action, { desc = "Code Action" } },
  { "n", "<leader>cr", vim.lsp.buf.rename, { desc = "Rename" } },
}

local function setup_lsp_keymaps(bufnr)
  for _, map in ipairs(lsp_keymaps) do
    local mode, lhs, rhs, opts = map[1], map[2], map[3], map[4]
    opts.buffer = bufnr
    vim.keymap.set(mode, lhs, rhs, opts)
  end
end

local capabilities = vim.lsp.protocol.make_client_capabilities()
capabilities.textDocument.completion.completionItem.snippetSupport = true

local blink_ok, blink = pcall(require, "blink.cmp")
if blink_ok then
  capabilities = blink.get_lsp_capabilities(capabilities)
end

require("mason-tool-installer").setup({ ensure_installed = servers })

for _, server in ipairs(servers) do
  local config = {
    capabilities = capabilities,
    on_attach = function(_, bufnr)
      setup_lsp_keymaps(bufnr)
    end,
  }

  if server == "lua_ls" then
    config.settings = {
      Lua = {
        runtime = { version = "LuaJIT" },
        workspace = {
          checkThirdParty = false,
          library = {
            vim.env.VIMRUNTIME,
            "${3rd}/luv/library",
          },
        },
        completion = { callSnippet = "Replace" },
        telemetry = { enable = false },
        hint = { enable = true },
      },
    }
  end

  vim.lsp.config(server, config)
end

vim.diagnostic.config({
  virtual_text = false,
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = "󰅚",
      [vim.diagnostic.severity.WARN] = "󰀪",
      [vim.diagnostic.severity.HINT] = "󰌶",
      [vim.diagnostic.severity.INFO] = "",
    },
  },
  underline = true,
  update_in_insert = false,
  severity_sort = true,
  float = {
    border = "rounded",
    source = true,
    header = "",
    prefix = "",
  },
})
