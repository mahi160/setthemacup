return {
  {
    "neovim/nvim-lspconfig",
    ---@class PluginLspOpts
    opts = {
      diagnostics = {
        virtual_text = false, -- completely disable, no prefix, no inline message
      },
      inlay_hints = { enabled = false },
    },
  },
}
