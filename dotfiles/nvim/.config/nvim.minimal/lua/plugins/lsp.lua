local lsp_servers = {
  lua_ls = {
    Lua = { workspace = { library = vim.api.nvim_get_runtime_file("lua", true) } },
  },
  harper_ls = {
    settings = {
      ['harper-ls'] = {
        linters = {
          SpellCheck = true
        },
        isolateToEnglish = true
      }
    }
  }
}

vim.pack.add({
  "https://github.com/neovim/nvim-lspconfig",                     -- default configs for lsps
  "https://github.com/mason-org/mason.nvim",                      -- package manager
  "https://github.com/mason-org/mason-lspconfig.nvim",            -- lspconfig bridge
  "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim", -- auto installer
}, { confirm = false })

require("mason").setup()
require("mason-lspconfig").setup()
require("mason-tool-installer").setup({
  ensure_installed = vim.tbl_keys(lsp_servers),
})

for server, config in pairs(lsp_servers) do
  vim.lsp.config(server, {
    settings = config,

    -- only create the keymaps if the server attaches successfully
    on_attach = function(_, bufnr)
      vim.keymap.set("n", "gd", vim.lsp.buf.definition, { buffer = bufnr, desc = "vim.lsp.buf.definition()" })
      vim.keymap.set("n", "gr", vim.lsp.buf.references, { buffer = bufnr, desc = "vim.lsp.buf.references()" })
      vim.keymap.set("n", "<leader>cr", vim.lsp.buf.rename, { buffer = bufnr, desc = "LSP: Re[name]" })
      vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, { buffer = bufnr, desc = "LSP: [C]ode [A]ction" })
      vim.keymap.set("n", "<leader>xx", vim.diagnostic.open_float, { buffer = bufnr, desc = "[D]iagnostics float" })
      vim.keymap.set("n", "<leader>f", vim.lsp.buf.format, { buffer = bufnr, desc = "LSP: [F]ormat Document" })
    end,
  })
end
