-- Theme plugins
vim.pack.add({
  "https://github.com/rebelot/kanagawa.nvim",
  "https://github.com/AlexvZyl/nordic.nvim",
}, { confirm = false })

local ok = pcall(vim.cmd.colorscheme, "nordic")
if not ok then
  pcall(vim.cmd.colorscheme, "kanagawa")
end
