return {
  {
    "gbprod/nord.nvim",
    lazy = false,
    priority = 1000,
    config = function()
      require("nord").setup({
        transparent = true,
      })
    end,
  },
  -- {
  --   "AlexvZyl/nordic.nvim",
  --   lazy = false,
  --   priority = 1000,
  --   config = function()
  --     require("nordic").setup({
  --       bold_keywords = true,
  --       -- transparent = {
  --       --   bg = true,
  --       --   float = true,
  --       -- },
  --       -- reduced_blue = false,
  --     })
  --   end,
  -- },
  -- {
  --   "sainnhe/everforest",
  --   config = function()
  --     vim.g.everforest_enable_italic = 1
  --     vim.g.everforest_better_performance = 1
  --     vim.g.everforest_background = "hard"
  --     -- vim.g.everforest_transparent_background = 2
  --   end,
  -- },
  -- {
  --   "folke/tokyonight.nvim",
  --   opts = {
  --     -- transparent = true,
  --   },
  -- },
  -- {
  --   "sainnhe/gruvbox-material",
  --
  --   config = function()
  --     vim.g.gruvbox_material_enable_italic = 1
  --     vim.g.gruvbox_material_background = "soft"
  --     vim.g.gruvbox_material_foreground = "mix"
  --     vim.g.gruvbox_material_transparent_background = 2
  --   end,
  -- },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "nord",
    },
  },
}
