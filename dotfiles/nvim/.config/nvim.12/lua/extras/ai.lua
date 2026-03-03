vim.pack.add({
  "https://github.com/zbirenbaum/copilot.lua",
  "https://github.com/giuxtaposition/blink-cmp-copilot",
})

local copilot_ok, copilot = pcall(require, "copilot")
if not copilot_ok then return end

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

