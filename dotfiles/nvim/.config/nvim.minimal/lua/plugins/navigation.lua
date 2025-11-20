Pack({
	"folke/flash.nvim", -- jump navigation
	"max397574/better-escape.nvim", -- jj to escape
	"sphamba/smear-cursor.nvim", -- smooth cursor animation
})

-- better escape: jj to escape insert mode
require("better_escape").setup()

-- flash: fast jump navigation
require("flash").setup()

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
