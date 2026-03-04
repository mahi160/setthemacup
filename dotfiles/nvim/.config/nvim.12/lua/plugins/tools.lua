Pack({
  "folke/lazydev.nvim",
  "folke/flash.nvim",
  "max397574/better-escape.nvim",
  "sphamba/smear-cursor.nvim",
  "wakatime/vim-wakatime",
  "brianhuster/live-preview.nvim",
  "derektata/lorem.nvim",
  "folke/which-key.nvim",
  "windwp/nvim-ts-autotag",
  "folke/todo-comments.nvim",
})

require("which-key").setup({
	preset = "modern",
})

require("todo-comments").setup({
	signs = true,
	keywords = {
		FIX = { icon = " ", color = "error", alt = { "FIXME", "BUG", "FIXIT", "ISSUE" } },
		TODO = { icon = " ", color = "info" },
		HACK = { icon = " ", color = "warning" },
		WARN = { icon = " ", color = "warning", alt = { "WARNING", "XXX" } },
		PERF = { icon = " ", alt = { "OPTIM", "PERFORMANCE", "OPTIMIZE" } },
		NOTE = { icon = " ", color = "hint", alt = { "INFO" } },
	},
})

require("lorem").opts({
  debounce_ms = 800,
})

require("nvim-ts-autotag").setup()

require("better_escape").setup()

require("flash").setup()

-- Flash keymaps
vim.keymap.set({ "n", "x", "o" }, "s", function()
	require("flash").jump()
end, { desc = "Flash Jump" })

vim.keymap.set({ "n", "x", "o" }, "S", function()
	require("flash").treesitter()
end, { desc = "Flash Treesitter" })

vim.keymap.set("o", "r", function()
	require("flash").remote()
end, { desc = "Remote Flash" })

vim.keymap.set({ "o", "x" }, "R", function()
	require("flash").treesitter_search()
end, { desc = "Treesitter Search" })

vim.keymap.set("c", "<c-s>", function()
	require("flash").toggle()
end, { desc = "Toggle Flash Search" })

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

require("lazydev").setup({
  ft = "lua",
  opts = {
    library = {
      { path = "${3rd}/luv/library", words = { "vim%.uv" } },
      { path = "snacks.nvim",        words = { "Snacks" } },
      { path = "./",                 words = { "Pack" } },
    },
  },
})
