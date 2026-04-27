vim.pack.add({
	-- fix lsp issue in lua config files
  "https://github.com/folke/lazydev.nvim",
	-- search nice with f
  "https://github.com/folke/flash.nvim",
	-- escape with jj
  "https://github.com/max397574/better-escape.nvim",
	-- nice cursor movement
  "https://github.com/sphamba/smear-cursor.nvim",
	-- track coding time
  "https://github.com/wakatime/vim-wakatime",
	-- live preview html/md files
  "https://github.com/brianhuster/live-preview.nvim",
	-- lorem ipsum
  "https://github.com/derektata/lorem.nvim",
  "https://github.com/folke/which-key.nvim",
  "https://github.com/windwp/nvim-ts-autotag",
  "https://github.com/folke/todo-comments.nvim",
  'https://github.com/MeanderingProgrammer/render-markdown.nvim',
})

require("better_escape").setup()
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
