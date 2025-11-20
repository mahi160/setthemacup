Pack({
	"rafamadriz/friendly-snippets",
	"fang2hou/blink-copilot",
	"zbirenbaum/copilot.lua",
	"saghen/blink.cmp",
})

require("copilot").setup({
	suggestion = { enabled = false },
	panel = { enabled = false },
})

require("blink.cmp").setup({
	fuzzy = { implementation = "lua" },
	keymap = { preset = "super-tab" },

	sources = {
		default = { "lsp", "path", "buffer", "snippets", "copilot" },
		providers = {
			copilot = {
				name = "copilot",
				module = "blink-copilot",
				score_offset = 100,
				async = true,
			},
		},
	},
	appearance = {
		use_nvim_cmp_as_default = false,
		nerd_font_variant = "mono",
	},

	completion = {
		documentation = { auto_show = true, auto_show_delay_ms = 200 },
		ghost_text = { enabled = true },
	},
})
