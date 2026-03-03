local cmp_ok, blink = pcall(require, "blink.cmp")
if not cmp_ok then return end

blink.setup({
  keymap = {
    preset = "default",
  },

  appearance = {
    use_nvim_cmp_as_default = false,
    nerd_font_variant = "normal",
  },

  sources = {
    default = { "lsp", "path", "snippets", "buffer" },
    providers = {
      snippets = {
        opts = {
          friendly_snippets = true,
          search_paths = { vim.fn.stdpath("config") .. "/snippets" },
        },
      },
    },
  },

  snippets = {
    preset = "luasnip",
  },

  completion = {
    accept = {
      auto_brackets = {
        enabled = true, -- Auto-add brackets/parens
      },
    },
    menu = {
      border = "rounded", -- Match winborder style
      scrollbar = true,
      max_height = 10,    -- Match pumheight
    },
    documentation = {
      auto_show = true,         -- Show docs automatically
      auto_show_delay_ms = 200, -- Short delay
      window = {
        border = "rounded",
      },
    },
  },

  signature = {
    enabled = true, -- Function signature help
    window = {
      border = "rounded",
    },
  },
})
