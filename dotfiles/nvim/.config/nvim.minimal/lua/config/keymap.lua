-- clear search highlights with <Esc>
vim.keymap.set("n", "<Esc>", "<cmd>nohlsearch<CR>")

local map = vim.keymap.set
local opts = function(desc)
  return { silent = true, noremap = true, desc = desc }
end

-- Save with Ctrl+S in all modes
map({ "n", "i", "v", "x", "s" }, "<C-s>", function()
  if vim.bo.modified then vim.cmd.write() end
  vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<Esc>", true, false, true), "n", false)
end, opts("Save buffer"))

-- Quit mappings
map("n", "<leader>qq", ":qa<CR>", opts("Quit all"))

-- Better window navigation
map("n", "<C-h>", "<C-w>h", opts("Window left"))
map("n", "<C-j>", "<C-w>j", opts("Window down"))
map("n", "<C-k>", "<C-w>k", opts("Window up"))
map("n", "<C-l>", "<C-w>l", opts("Window right"))
-- Buffer navigation
map("n", "H", ":bprevious<CR>", opts("Previous buffer"))
map("n", "L", ":bnext<CR>", opts("Next buffer"))


-- Move selected lines in visual mode
map("v", "K", ":m '<-2<CR>gv=gv", opts("Move selection up"))
map("v", "J", ":m '>+1<CR>gv=gv", opts("Move selection down"))


-- Toggle spellcheck
map("n", "<leader>sc", function()
  vim.opt.spell = not vim.opt.spell:get()
end, opts("Toggle spell"))
map("n", "<leader>ss", "z=", opts("Spelling suggestions"))

-- Buffer close helpers
map("n", "<leader>bd", ":bdelete<CR>", opts("Delete current buffer"))
map("n", "<leader>bo", function()
  local cur = vim.api.nvim_get_current_buf()
  for _, b in ipairs(vim.api.nvim_list_bufs()) do
    if b ~= cur and vim.api.nvim_buf_is_loaded(b) and vim.bo[b].buflisted then
      -- skip modified buffers to avoid data loss
      if not vim.bo[b].modified then
        pcall(vim.api.nvim_buf_delete, b, {})
      end
    end
  end
end, opts("Delete other buffers"))

