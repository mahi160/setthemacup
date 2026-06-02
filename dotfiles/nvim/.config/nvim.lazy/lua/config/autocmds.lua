-- relative number toggle
vim.api.nvim_create_autocmd("InsertEnter", {
  group = vim.api.nvim_create_augroup("number_insert", { clear = true }),
  callback = function()
    vim.o.relativenumber = false
  end,
})

vim.api.nvim_create_autocmd("InsertLeave", {
  group = vim.api.nvim_create_augroup("number_normal", { clear = true }),
  callback = function()
    vim.o.relativenumber = true
  end,
})

-- spell only prose files
vim.api.nvim_create_autocmd("FileType", {
  group = vim.api.nvim_create_augroup("spell_files", { clear = true }),
  pattern = { "markdown", "gitcommit", "text" },
  callback = function()
    vim.opt_local.spell = true
  end,
})

-- disable comment continuation
vim.api.nvim_create_autocmd("FileType", {
  group = vim.api.nvim_create_augroup("no_comment_continue", { clear = true }),
  callback = function()
    vim.opt_local.formatoptions:remove({ "c", "r", "o" })
  end,
})

-- help on right split
vim.api.nvim_create_autocmd("FileType", {
  group = vim.api.nvim_create_augroup("help_right", { clear = true }),
  pattern = "help",
  command = "wincmd L",
})
