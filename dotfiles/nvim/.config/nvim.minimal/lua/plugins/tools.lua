-- Utility tools and external integrations
vim.pack.add({
	"https://github.com/wakatime/vim-wakatime", -- time tracking
	"https://github.com/brianhuster/live-preview.nvim", -- markdown/html preview
	"https://github.com/derektata/lorem.nvim", -- lorem ipsum generator
	"https://github.com/folke/which-key.nvim", -- key binding helper
	"https://github.com/windwp/nvim-ts-autotag", -- auto close html tags
}, { confirm = false })

-- lorem ipsum: text placeholder generator
require("lorem").opts({
	debounce_ms = 800,
})

-- autotag: automatically close html/xml tags
require("nvim-ts-autotag").setup()