local lsp_servers = {
  lua_ls = {
    Lua = { workspace = { library = vim.api.nvim_get_runtime_file("lua", true) } },
  },
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
      vim.keymap.set("n", "grd", vim.lsp.buf.definition, { buffer = bufnr, desc = "vim.lsp.buf.definition()" })

      vim.keymap.set("n", "<leader>f", vim.lsp.buf.format, { buffer = bufnr, desc = "LSP: [F]ormat Document" })
    end,
  })
end
