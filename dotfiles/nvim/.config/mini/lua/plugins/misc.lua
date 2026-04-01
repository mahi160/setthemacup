return {
  {
    "folke/todo-comments.nvim",
  },
  {
    "wakatime/vim-wakatime",
  },
  {
    "folke/lazydev.nvim",
    config = function()
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
    end
  },
  {
    "max397574/better-escape.nvim",
    config = function()
      require("better_escape").setup()
    end
  },
  {
    "sphamba/smear-cursor.nvim",
    config = function()
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
    end
  },
  {
    "folke/which-key.nvim",
  }
}
