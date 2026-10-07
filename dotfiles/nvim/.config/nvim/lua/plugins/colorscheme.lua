-- ~/.config/theme: written by scripts/toggle-theme.sh
local f = io.open(vim.env.HOME .. "/.config/theme")
local active = f and vim.trim(f:read("*a")) or "kanagawa-wave"
if f then f:close() end

return {
  {
    "mahi160/kanagawa.nvim",
    lazy = true,
    opts = {
      compile = false,
      undercurl = true,
      commentStyle = { italic = true },
      keywordStyle = { italic = true },
      statementStyle = { bold = true },
      transparent = true,
      dimInactive = false,
      terminalColors = true,
      theme = "wave",
      background = { dark = "wave", light = "lotus" },
      colors = {
        theme = {
          all = {
            ui = { bg_gutter = "none" },
          },
        },
      },
      overrides = function(colors)
        local theme = colors.theme
        return {
          -- floating windows
          NormalFloat = { bg = "none" },
          FloatBorder = { bg = "none" },
          FloatTitle = { bg = "none" },
          -- gutter
          SignColumn = { bg = "none" },
          LineNr = { bg = "none" },
          FoldColumn = { bg = "none" },
          -- statusline / tabline
          StatusLine = { bg = "none" },
          StatusLineNC = { bg = "none" },
          TabLine = { bg = "none" },
          TabLineFill = { bg = "none" },
          -- lazy / mason popups
          LazyNormal = { bg = "none" },
          MasonNormal = { bg = "none" },
          -- end of buffer
          EndOfBuffer = { bg = "none" },
          -- telescope (if used)
          TelescopeNormal = { bg = "none" },
          TelescopeBorder = { bg = "none" },
        }
      end,
    },
  },

  {
    "sainnhe/gruvbox-material",
    config = function()
      vim.g.gruvbox_material_enable_italic = 1
      vim.g.gruvbox_material_better_performance = 1
      vim.g.gruvbox_material_background = "hard"
      vim.g.gruvbox_material_transparent_background = 2
      -- vim.g.gruvbox_material_foreground = "mix"
      -- vim.g.gruvbox_material_cursor = "green"
    end,
  },

  {
    "sainnhe/everforest",
    config = function()
      vim.g.everforest_enable_italic = 1
      vim.g.everforest_better_performance = 1
      vim.g.everforest_background = "hard"
      vim.g.everforest_transparent_background = 2
    end,
  },

  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = ({ gruvbox = "gruvbox-material", everforest = "everforest" })[active] or "kanagawa",
    },
  },
}
