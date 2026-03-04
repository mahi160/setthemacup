local ok, blink = pcall(require, "blink.cmp")
if not ok then
  return
end

blink.setup({
  fuzzy = { implementation = "lua" },
  keymap = { preset = "default" },
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
  snippets = { preset = "luasnip" },
  completion = {
    accept = { auto_brackets = { enabled = true } },
    menu = { border = "rounded", scrollbar = true, max_height = 10 },
    documentation = {
      auto_show = true,
      auto_show_delay_ms = 200,
      window = { border = "rounded" },
    },
  },
  signature = { enabled = true, window = { border = "rounded" } },
})
