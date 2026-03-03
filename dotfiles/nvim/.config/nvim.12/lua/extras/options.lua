-- Experimental Options
-- Uncomment in init.lua with: require("extras.options")

-- Transparency
vim.opt.pumblend = 10              -- Popup menu transparency
vim.opt.winblend = 10              -- Floating window transparency

-- Visual enhancements
vim.opt.conceallevel = 2           -- Hide/prettify special syntax
vim.opt.list = true                -- Show invisible characters
vim.opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }
vim.opt.fillchars = { eob = ' ', fold = ' ', foldopen = '', foldclose = '' }

-- Advanced editing
vim.opt.virtualedit = "block"      -- Allow cursor past line end in visual block mode

-- Grep integration
if vim.fn.executable("rg") == 1 then
  vim.opt.grepprg = "rg --vimgrep"
  vim.opt.grepformat = "%f:%l:%c:%m"
end

-- Session options
vim.opt.sessionoptions = { "buffers", "curdir", "tabpages", "winsize", "help", "globals", "skiprtp", "folds" }

-- Spell checking
vim.opt.spell = false              -- Disable vim spell (using harper_ls LSP)
vim.opt.spelllang = "en_us"

-- Treesitter folding (uncomment when treesitter is added)
-- vim.opt.foldmethod = "expr"
-- vim.opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"
-- vim.opt.foldlevelstart = 99
-- vim.opt.foldtext = ""

-- Performance (uncomment if you use macros frequently)
-- vim.opt.lazyredraw = true
