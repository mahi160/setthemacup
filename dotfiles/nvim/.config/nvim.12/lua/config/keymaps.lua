-- Helper for keymap options
local map = vim.keymap.set
local opts = function(desc)
  return { silent = true, noremap = true, desc = desc }
end

-- Clear search highlights with <Esc>
map("n", "<Esc>", "<cmd>nohlsearch<CR>", opts("Clear search highlights"))

-- Quit all
map("n", "<leader>qq", "<cmd>qa<CR>", opts("Quit all"))
