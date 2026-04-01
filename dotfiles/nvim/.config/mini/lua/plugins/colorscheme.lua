return {
  {
    "folke/tokyonight.nvim",
    lazy = false,
    priority = 1000,
    opts = {

    },
    config = function()
      require("tokyonight").setup({
        style = "night",
        transparent = true,
        styles = {
          comments = { italic = true },
          keywords = { italic = true },
          functions = { italic = true },
          variables = { italic = true },
          sidebars = "transparent",
          floats = "transparent",
        },
      })
    end
  }
}
