vim.opt.pumblend = 10         -- Popup menu transparency
vim.opt.winblend = 10         -- Floating window transparency
vim.opt.conceallevel = 2      -- Hide/prettify special syntax
vim.opt.list = true           -- Show invisible characters
vim.opt.virtualedit = "block" -- Allow cursor past line end in visual block mode

vim.opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }


vim.opt.spell = false                                                 -- Spelling disabled by default
vim.opt.spelllang = "en_us"                                           -- Spelling language
vim.opt.spellfile = vim.fn.stdpath("config") .. "/spell/en.utf-8.add" -- Custom words file
