return {
  {
    "neovim/nvim-lspconfig",
    opts = {
      inlay_hints = {
        enabled = false,
      },
      servers = {
        ["stylelint-language-server"] = {
          settings = {
            stylelint = {
              autoFixOnSave = false,
              autoFixOnFormat = false,
            },
          },
        },
      },
    },
  },
}
