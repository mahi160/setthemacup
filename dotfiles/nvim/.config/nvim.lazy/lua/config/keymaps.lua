local map = vim.keymap.set
local opts = function(desc)
  return { silent = true, noremap = true, desc = desc }
end

map("n", "<S-j>", "<cmd>b#<CR>", opts("Last buffer"))
map("n", "-", "<cmd>Oil<CR>", opts("Open parent dir"))
