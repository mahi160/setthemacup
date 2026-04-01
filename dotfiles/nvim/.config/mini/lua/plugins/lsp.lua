local lsp_servers = {
  lua_ls = {
    Lua = { workspace = { library = vim.api.nvim_get_runtime_file("lua", true) } },
  },
  vtsls = {},
  eslint_d = {},
  prettierd = {},
  gopls = {
    settings = {
      gopls = {
        analyses = {
          unusedparams = true,
          shadow = true,
        },
        staticcheck = true,
        gofumpt = true,
        hints = {
          assignVariableTypes = true,
          compositeLiteralFields = true,
          compositeLiteralTypes = true,
          constantValues = true,
          functionTypeParameters = true,
          parameterNames = true,
          rangeVariableTypes = true,
        },
      },
    },
  },
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

return {
  "neovim/nvim-lspconfig",
  dependencies = {
    "mason-org/mason.nvim",
    "mason-org/mason-lspconfig.nvim",
    "WhoIsSethDaniel/mason-tool-installer.nvim",
  },
  config = function()
    require("mason").setup()
    require("mason-lspconfig").setup()
    require("mason-tool-installer").setup({
      ensure_installed = vim.tbl_keys(lsp_servers),
    })

    for server, config in pairs(lsp_servers) do
      vim.lsp.config(server, {
        settings = config,

        on_attach = function(_, bufnr)
          vim.keymap.set("n", "gd", vim.lsp.buf.definition, { buffer = bufnr, desc = "Goto Definition" })
          vim.keymap.set("n", "gr", vim.lsp.buf.references, { buffer = bufnr, desc = "References" })
          vim.keymap.set("n", "gD", vim.lsp.buf.declaration, { buffer = bufnr, desc = "Goto Declaration" })
          vim.keymap.set("n", "gi", vim.lsp.buf.implementation, { buffer = bufnr, desc = "Goto Implementation" })
          vim.keymap.set("n", "gy", vim.lsp.buf.type_definition, { buffer = bufnr, desc = "Goto Type Definition" })
          vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, { buffer = bufnr, desc = "Code Action" })
          vim.keymap.set("n", "<leader>cr", vim.lsp.buf.rename, { buffer = bufnr, desc = "Rename" })
          vim.keymap.set("n", "<leader>cd", vim.diagnostic.open_float, { buffer = bufnr, desc = "Line Diagnostics" })
          vim.keymap.set("n", "<leader>ch", function()
            local enabled = vim.lsp.inlay_hint.is_enabled({ bufnr = bufnr })
            vim.lsp.inlay_hint.enable(not enabled, { bufnr = bufnr })
          end, { buffer = bufnr, desc = "Toggle Inlay Hints" })
        end,
      })
    end
  end
}
