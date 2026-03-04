vim.pack.add({ "https://github.com/max397574/better-escape.nvim", "https://github.com/folke/which-key.nvim" })

local escape_ok, better_escape = pcall(require, "better_escape")
if escape_ok then
  better_escape.setup()
end
