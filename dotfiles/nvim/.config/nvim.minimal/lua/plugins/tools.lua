Pack({
	"wakatime/vim-wakatime",
	"brianhuster/live-preview.nvim",
	"derektata/lorem.nvim",
	"folke/which-key.nvim",
	"windwp/nvim-ts-autotag",
})

require("lorem").opts({
	debounce_ms = 800,
})

require("nvim-ts-autotag").setup()
