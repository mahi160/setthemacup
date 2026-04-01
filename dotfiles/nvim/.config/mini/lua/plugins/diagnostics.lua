return {
  "rachartier/tiny-inline-diagnostic.nvim",
  config = function()
    vim.diagnostic.config({
      virtual_text = false,
      signs = {
        text = {
          [vim.diagnostic.severity.ERROR] = " ",
          [vim.diagnostic.severity.WARN] = " ",
          [vim.diagnostic.severity.INFO] = " ",
          [vim.diagnostic.severity.HINT] = " ",
        },
      },
    })
    require("tiny-inline-diagnostic").setup({
      preset = "ghost",
    })
  end
}
