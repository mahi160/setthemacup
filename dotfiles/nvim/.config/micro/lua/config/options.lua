-- Leaders
vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- Editor UI
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.signcolumn = "yes:1"
vim.opt.wrap = true
vim.opt.confirm = true

-- Indentation
vim.opt.expandtab = true
vim.opt.shiftwidth = 2
vim.opt.tabstop = 2
vim.opt.softtabstop = 2

-- Spell checking
vim.opt.spellfile = vim.fn.stdpath("config") .. "/spell/en.utf-8.add"
