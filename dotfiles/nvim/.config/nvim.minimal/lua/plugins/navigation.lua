-- Movement, navigation, and cursor enhancements
vim.pack.add({
	"https://github.com/folke/flash.nvim", -- jump navigation
	"https://github.com/max397574/better-escape.nvim", -- jj to escape
	"https://github.com/sphamba/smear-cursor.nvim", -- smooth cursor animation
}, { confirm = false })

-- better escape: jj to escape insert mode
require("better_escape").setup()

-- flash: fast jump navigation
require("flash").setup({
	keys = {
		{
			"<CR>",
			mode = { "n", "x", "o" },
			function()
				require("flash").jump()
			end,
			desc = "Flash",
		},
		{
			"r",
			mode = "o",
			function()
				require("flash").remote()
			end,
			desc = "Remote Flash",
		},
		{
			"R",
			mode = { "o", "x" },
			function()
				require("flash").treesitter_search()
			end,
			desc = "Treesitter Search",
		},
		{
			"<c-s>",
			mode = { "c" },
			function()
				require("flash").toggle()
			end,
			desc = "Toggle Flash Search",
		},
	},
})

-- smear cursor: smooth cursor animation
require("smear_cursor").setup({
	opts = {
		stiffness = 0.8,
		trailing_stiffness = 0.6,
		stiffness_insert_mode = 0.7,
		trailing_stiffness_insert_mode = 0.7,
		damping = 0.95,
		damping_insert_mode = 0.95,
		distance_stop_animating = 0.5,
		time_interval = 7,
	},
})