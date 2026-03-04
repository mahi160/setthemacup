-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
local map = vim.keymap.set
local opts = function(desc)
  return { silent = true, noremap = true, desc = desc }
end

map("n", "J", function()
  local last = vim.fn.bufnr("#") -- alternate buffer
  if last > 0 and vim.api.nvim_buf_is_loaded(last) and vim.bo[last].buflisted then
    vim.cmd("buffer " .. last)
  end
end, opts("Switch to last open buffer"))
