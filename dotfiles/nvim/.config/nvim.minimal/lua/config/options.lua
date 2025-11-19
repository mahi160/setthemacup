-- Leader keys
vim.g.mapleader = " " -- Global leader key
vim.g.maplocalleader = " " -- Local leader key

-- UI / Display
vim.opt.termguicolors = true -- Enable 24-bit colors
vim.opt.number = true -- Show line numbers
vim.opt.relativenumber = true -- Relative line numbers
vim.opt.signcolumn = "yes" -- Always show sign column
vim.opt.cursorline = true -- Highlight current line
vim.opt.wrap = true -- Wrap long lines
-- vim.opt.list = true           -- Visualize invisible chars
-- vim.opt.listchars = { tab = "» ", trail = "·", nbsp = "␣" }
vim.opt.winborder = "rounded" -- Rounded popup borders
vim.opt.scrolloff = 12 -- Context lines above/below cursor

-- Interaction / Behavior
vim.opt.mouse = "a" -- Enable mouse support
vim.opt.showmode = false -- Hide mode indicator
vim.opt.splitright = true -- Vertical splits go right
vim.opt.splitbelow = true -- Horizontal splits go below
vim.opt.timeoutlen = 300 -- Keymap timeout
vim.opt.updatetime = 250 -- Faster diagnostics

-- Search
vim.opt.ignorecase = true -- Case-insensitive search...
vim.opt.smartcase = true -- ...unless uppercase in pattern
vim.opt.hlsearch = true -- Highlight search results
-- vim.opt.inccommand = "split"  -- Live substitution preview

-- Editing / Files
vim.opt.clipboard = "unnamedplus" -- System clipboard
vim.opt.breakindent = true -- Preserve indent on wrapped lines
vim.opt.undofile = true -- Persistent undo
vim.opt.swapfile = false -- Disable swap files
vim.g.autoformat = true -- Custom: enable auto-formatting

-- Indentation / Formatting
vim.opt.tabstop = 2 -- Tab width (display)
vim.opt.shiftwidth = 2 -- Indent width
vim.opt.expandtab = true -- Convert tabs to spaces
vim.opt.textwidth = 80 -- Auto-wrap at 80 columns

-- Diagnostics
vim.diagnostic.config({
	signs = {
		text = {
			[vim.diagnostic.severity.ERROR] = " ",
			[vim.diagnostic.severity.WARN] = " ",
			[vim.diagnostic.severity.INFO] = " ",
			[vim.diagnostic.severity.HINT] = " ",
		},
	},
})
