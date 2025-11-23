Pack("folke/lazydev.nvim")
require("lazydev").setup({
	ft = "lua",
	opts = {
		library = {
			{ path = "${3rd}/luv/library", words = { "vim%.uv" } },
			{ path = "snacks.nvim", words = { "Snacks" } },
			{ path = "./", words = { "Pack" } },
		},
	},
})
