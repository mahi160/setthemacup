Pack({
  "folke/lazydev.nvim",
  "folke/flash.nvim",
  "max397574/better-escape.nvim",
  "sphamba/smear-cursor.nvim",
  "wakatime/vim-wakatime",
  "brianhuster/live-preview.nvim",
  "derektata/lorem.nvim",
  "folke/which-key.nvim",
  "windwp/nvim-ts-autotag",
  "folke/todo-comments.nvim",
  'https://github.com/MeanderingProgrammer/render-markdown.nvim',
})

require("better_escape").setup()
require("flash").setup()
require("flash").setup()

require("smear_cursor").setup({
  opts = {
    stiffness = 0.8,
    trailing_stiffness = 0.6,
    stiffness_insert_mode = 0.7,
    trailing_stiffness_insert_mode = 0.7,
    damping = 0.95,
    damping_insert_mode = 0.95,
    distance_stop_animating = 0.5,
    time_interval = 7,
  },
})

require("lazydev").setup({
  ft = "lua",
  opts = {
    library = {
      { path = "${3rd}/luv/library", words = { "vim%.uv" } },
      { path = "snacks.nvim",        words = { "Snacks" } },
      { path = "./",                 words = { "Pack" } },
    },
  },
})
