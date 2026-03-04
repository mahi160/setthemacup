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

-- Tab settings (4 spaces, convert tabs to spaces)
vim.opt.tabstop = 4        -- Width of tab character
vim.opt.shiftwidth = 4     -- Width for autoindent
vim.opt.softtabstop = 4    -- Backspace deletes this many spaces
vim.opt.expandtab = true   -- Convert tabs to spaces

-- Command line behavior (show but don't persist messages)
vim.opt.showcmd = false    -- Don't show partial commands (prevents persistence)

