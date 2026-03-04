vim.pack.add({
  "https://github.com/zbirenbaum/copilot.lua",
  "https://github.com/giuxtaposition/blink-cmp-copilot",
})

local copilot_ok, copilot = pcall(require, "copilot")
if not copilot_ok then
  return
end

copilot.setup({
  suggestion = { enabled = false },
  panel = { enabled = false },
  filetypes = {
    yaml = false,
    markdown = true,
    help = false,
    gitcommit = false,
    gitrebase = false,
    ["."] = false,
  },
})

local blink_ok, blink = pcall(require, "blink.cmp")
if not blink_ok then
  return
end

blink.setup({
  sources = {
    default = { "lsp", "path", "snippets", "buffer", "copilot" },
    providers = {
      copilot = {
        name = "copilot",
        module = "blink-cmp-copilot",
        kind = "Copilot",
        score_offset = 100,
        async = true,
      },
    },
  },
  appearance = {
    kind_icons = {
      Copilot = "",
    },
  },
})
