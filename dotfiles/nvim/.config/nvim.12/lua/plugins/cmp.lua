vim.pack.add({
  "https://github.com/L3MON4D3/LuaSnip",
  "https://github.com/rafamadriz/friendly-snippets",
  -- "https://github.com/fang2hou/blink-copilot",
  -- "https://github.com/zbirenbaum/copilot.lua",
  "https://github.com/saghen/blink.cmp",
	"https://github.com/supermaven-inc/supermaven-nvim"
})

-- require("copilot").setup({
--   suggestion = { enabled = false },
--   panel = { enabled = false },
-- })
require("supermaven-nvim").setup({
	keymaps = {
    accept_suggestion = nil,
	},
})

require("blink.cmp").setup({
  fuzzy = { implementation = "lua" },
  -- keymap = { preset = "enter" },
  snippets = { preset = "luasnip" },

  sources = {
    default = { "lsp", "path", "snippets", "buffer",},
    -- providers = {
    --   copilot = {
    --     name = "copilot",
    --     module = "blink-copilot",
    --     async = true,
    --   },
    -- },
  },
  appearance = {
    use_nvim_cmp_as_default = false,
    nerd_font_variant = "mono",
  },
  signature = { enabled = true },

  completion = {
    documentation = { auto_show = true, auto_show_delay_ms = 200 },
    ghost_text = { enabled = false },
    menu = {
      auto_show = true,
      draw = {
        treesitter = { "lsp" },
        columns = { { "kind_icon", "label", "label_description", gap = 1 }, { "kind" } },
      },
    },
  },
})
