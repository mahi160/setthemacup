-- LSP server configurations
local servers = {
  lua_ls = {
    Lua = { workspace = { library = vim.api.nvim_get_runtime_file("lua", true) } },
  },
  vtsls = {},
  eslint = {},
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
}

local function setup_keymaps(bufnr)
  for _, map in ipairs(keymaps) do
    local mode, lhs, rhs, opts = map[1], map[2], map[3], map[4]
    opts.buffer = bufnr
    vim.keymap.set(mode, lhs, rhs, opts)
  end
end

-- Install LSP servers
require("mason-tool-installer").setup({
  ensure_installed = vim.tbl_keys(servers)
})

-- Configure LSP servers
for server, config in pairs(servers) do
  vim.lsp.config(server, {
    settings = config,
    on_attach = function(_, bufnr)
      setup_keymaps(bufnr)
    end,
  })
end
