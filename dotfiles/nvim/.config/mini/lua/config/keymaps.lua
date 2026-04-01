-- Helper for keymap options
local map = vim.keymap.set
local opts = function(desc)
  return { silent = true, noremap = true, desc = desc }
end

-- Clear search highlights with <Esc>
map("n", "<Esc>", "<cmd>nohlsearch<CR>", opts("Clear search highlights"))

-- Quit all
map("n", "<leader>qq", "<cmd>qa<CR>", opts("Quit all"))

-- Buffer navigation
map("n", "H", "<cmd>bprevious<CR>", opts("Previous buffer"))
map("n", "L", "<cmd>bnext<CR>", opts("Next buffer"))
map("n", "J", function()
  local last = vim.fn.bufnr("#") -- alternate buffer
  if last > 0 and vim.api.nvim_buf_is_loaded(last) and vim.bo[last].buflisted then
    vim.cmd("buffer " .. last)
  end
end, opts("Switch to last open buffer"))
