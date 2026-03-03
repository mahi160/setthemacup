vim.opt.pumblend = 10         -- Popup menu transparency
vim.opt.winblend = 10         -- Floating window transparency
vim.opt.conceallevel = 2      -- Hide/prettify special syntax
vim.opt.list = true           -- Show invisible characters
vim.opt.virtualedit = "block" -- Allow cursor past line end in visual block mode
vim.opt.spell = false         -- Disable vim spell (using harper_ls LSP)
vim.opt.spelllang = "en_us"
vim.opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }
-- vim.opt.fillchars = { eob = ' ', fold = ' ', foldopen = '', foldclose = '' }

-- Session options (what gets saved with :mksession)
-- Only needed if you save/restore sessions to preserve workspace state
-- vim.opt.sessionoptions = { "buffers", "curdir", "tabpages", "winsize", "help", "globals", "skiprtp", "folds" }

-- Grep integration (use ripgrep for :grep command)
-- Only useful if you manually use :grep, :lgrep, etc. in command mode
-- if vim.fn.executable("rg") == 1 then
--   vim.opt.grepprg = "rg --vimgrep"
--   vim.opt.grepformat = "%f:%l:%c:%m"
-- end

-- Performance (uncomment if you use macros frequently)
-- vim.opt.lazyredraw = true
