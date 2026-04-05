vim.keymap.set("n", "-", "<CMD>Oil<CR>", { desc = "[O]pen parent directory" })
vim.keymap.set("i", "jj", "<Esc>", { desc = "Escape to Normal mode" })

vim.keymap.set("n", "H", "<cmd>:bn<cr>", { desc = "[N]ext [B]uffer" })
vim.keymap.set("n", "L", "<cmd>:bp<cr>", { desc = "[P]revious [B]uffer" })
vim.keymap.set("n", "J", function()
  local last = vim.fn.bufnr("#")
  if last > 0 and vim.api.nvim_buf_is_loaded(last) and vim.bo[last].buflisted then
    vim.cmd("buffer " .. last)
  end
end, { desc = "[P]revious [B]uffer" })
