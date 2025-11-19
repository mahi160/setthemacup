-- Utility tools and external integrations
pack({
	"wakatime/vim-wakatime", -- time tracking
	"brianhuster/live-preview.nvim", -- markdown/html preview
	"derektata/lorem.nvim", -- lorem ipsum generator
	"folke/which-key.nvim", -- key binding helper
	"windwp/nvim-ts-autotag", -- auto close html tags
})

-- lorem ipsum: text placeholder generator
require("lorem").opts({
	debounce_ms = 800,
})

-- autotag: automatically close html/xml tags
require("nvim-ts-autotag").setup()