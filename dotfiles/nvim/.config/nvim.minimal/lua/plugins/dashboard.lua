require("mini.starter").setup({
	header = function()
		local ms = vim.g.startup_time and math.floor((vim.loop.hrtime() - vim.g.startup_time) / 1000000) or 0

		return string.format(
			[[
  ┌─────────────────────────────────────┐
  │                                     │
  │           workstation               │
  │                                     │
  │        Lost in the echo             │
  │                                     │
  │         Loaded in %3dms             │
  │                                     │
  └─────────────────────────────────────┘
]],
			ms
		)
	end,

	items = {
		{ name = "Find files", action = "Telescope find_files", section = "Search" },
		{ name = "Recent files", action = "Telescope oldfiles", section = "Search" },
		{ name = "Grep text", action = "Telescope live_grep", section = "Search" },
		{ name = "Config", action = "e $MYVIMRC", section = "Config" },
		{ name = "Sync plugins", action = "Sync", section = "System" },
		{ name = "Quit", action = "qa", section = "System" },
	},

	footer = function()
		local plugin_count = 0
		for _ in vim.fs.dir(vim.fn.stdpath("config") .. "/lua/plugins") do
			plugin_count = plugin_count + 1
		end
		return string.format("🚀 %d plugin files loaded", plugin_count)
	end,
})
