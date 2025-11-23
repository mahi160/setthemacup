return {
  {
    "brianhuster/live-preview.nvim",
  },
  {
    "wakatime/vim-wakatime",
  },
  {
    "derektata/lorem.nvim",
    config = function()
      require("lorem").opts({
        sentence_length = "mixed",
        format_defaults = {},
        comma_chance = 0.3,
        max_commas = 2,
        debounce_ms = 200,
      })
    end,
  },
  {
    "max397574/better-escape.nvim",
    config = function()
      require("better_escape").setup()
    end,
  },
}
