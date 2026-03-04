vim.g.mapleader = " "
vim.g.maplocalleader = " "

vim.opt.relativenumber = true
vim.opt.wrap = true
vim.opt.winborder = "rounded"
vim.opt.scrolloff = 12
vim.opt.inccommand = "split"
vim.opt.clipboard = "unnamedplus"
vim.opt.swapfile = false
vim.opt.textwidth = 120
vim.opt.pumheight = 10
vim.opt.shortmess:append("WIcC")
vim.opt.spell = false
vim.opt.spelllang = "en_us"
vim.opt.spellfile = vim.fn.stdpath("config") .. "/spell/en.utf-8.add"
vim.opt.foldlevelstart = 99
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"
vim.opt.conceallevel = 2

vim.g.autoformat = true
