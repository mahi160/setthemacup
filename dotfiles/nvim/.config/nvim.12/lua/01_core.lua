require("vim._core.ui2").enable({})
vim.cmd.packadd("nvim.undotree")

vim.g.mapleader = " "

vim.o.undofile = true
vim.o.number = true
vim.o.relativenumber = true
vim.o.signcolumn = "yes"
vim.o.ignorecase = true
vim.o.smartcase = true
vim.o.colorcolumn = "120"
vim.o.textwidth = 120
vim.o.wrap = true
vim.o.swapfile = false
vim.o.confirm = true
vim.o.linebreak = true
vim.o.breakindent = true
vim.o.termguicolors = true
vim.o.splitright = true
vim.o.splitbelow = true
vim.o.scrolloff = 8
vim.o.sidescrolloff = 8
-- vim.o.updatetime = 250
vim.o.pumheight = 10
vim.o.tabstop = 2
vim.o.shiftwidth = 2
vim.o.expandtab = true
vim.o.keywordprg = ":help!"
vim.o.foldmethod = "expr"
vim.o.foldexpr = "v:lua.vim.lsp.foldexpr()"
vim.o.foldlevel = 99
vim.o.foldlevelstart = 99
vim.o.spelllang = "en"
vim.o.spellfile = vim.fn.stdpath("config") .. "/spell/en.utf-8.add"

-- Live preview of :s substitutions in a split
vim.o.inccommand = "split"

-- Sync default register with system clipboard (off by default; uncomment to enable)
-- vim.opt.clipboard:append("unnamedplus")
