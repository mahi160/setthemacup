vim.pack.add({
  "https://github.com/folke/which-key.nvim",
  "https://github.com/windwp/nvim-autopairs",
  "https://github.com/VidocqH/auto-indent.nvim",
  "https://github.com/folke/todo-comments.nvim",
  "https://github.com/max397574/better-escape.nvim",
  "https://github.com/rachartier/tiny-inline-diagnostic.nvim",
  "https://github.com/wakatime/vim-wakatime"
}, { confirm = false })

vim.pack.add({}, {})

require("which-key").setup({
  spec = {
    { "<leader>b", group = "[B]uffer" },
    { "<leader>s", group = "[S]earch" },
    { "<leader>q", group = "[Q]uit" },
    { "<leader>d", group = "[D]iagnostics" },
  },
})

-- Editing helpers
require("nvim-autopairs").setup()
require("auto-indent").setup()
require("todo-comments").setup()
require("better_escape").setup()
require("tiny-inline-diagnostic").setup({
  preset = "ghost",
})
