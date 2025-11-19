vim.pack.add({
	"https://github.com/sainnhe/sonokai",
	"https://github.com/sainnhe/everforest",
	"https://github.com/max397574/better-escape.nvim",
	"https://github.com/folke/todo-comments.nvim",
	"https://github.com/rachartier/tiny-inline-diagnostic.nvim",
	"https://github.com/wakatime/vim-wakatime",
	"https://github.com/brianhuster/live-preview.nvim",
	"https://github.com/folke/which-key.nvim",
	"https://github.com/sphamba/smear-cursor.nvim",
	"https://github.com/derektata/lorem.nvim",
	"https://github.com/folke/flash.nvim",
	"https://github.com/windwp/nvim-ts-autotag",
	"https://github.com/stevearc/quicker.nvim",
}, { confirm = false })

-- colorscheme: sonokai
vim.g.sonokai_enable_italic = 1
vim.g.sonokai_better_performance = 1
vim.g.sonokai_background = "hard"
vim.g.sonokai_transparent_background = 2

-- colorscheme: everforest
vim.g.everforest_enable_italic = 1
vim.g.everforest_better_performance = 1
vim.g.everforest_background = "hard"
vim.g.everforest_transparent_background = 2
vim.cmd("colorscheme everforest")

-- better escape, jj to escape
require("better_escape").setup()

-- todo comments highlighter
require("todo-comments").setup()

-- inline diagnostics
require("tiny-inline-diagnostic").setup({
	preset = "ghost",
})
vim.diagnostic.config({ virtual_text = false })

-- animate smear-cursor
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

-- Lorem ipsum generator
require("lorem").opts({
	debounce_ms = 800,
})

-- Flash navigation
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

-- Autotag for html, xml, etc.
require("nvim-ts-autotag").setup()

-- Quicker
require("quicker").setup()
vim.keymap.set("n", "<leader>q", function()
	require("quicker").toggle()
end, {
	desc = "Toggle quickfix",
})
vim.keymap.set("n", "<leader>l", function()
	require("quicker").toggle({ loclist = true })
end, {
	desc = "Toggle loclist",
})
