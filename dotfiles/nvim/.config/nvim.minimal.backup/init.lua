-- Track startup time for performance monitoring
if not vim.g.startup_time then
	vim.g.startup_time = vim.loop.hrtime()
end

-- Helper function to simplify plugins declarations
function Pack(plugins, opts)
	opts = opts or { confirm = false }

	local plugin_list = type(plugins) == "table" and plugins or { plugins }
	local processed_plugins = {}
	for _, plugin in ipairs(plugin_list) do
		if not plugin:match("^https?://") and not plugin:match("^git@") then
			if plugin:match("^[%w%-_%.]+/[%w%-_%.]+$") then
				plugin = "https://github.com/" .. plugin
			end
		end
		table.insert(processed_plugins, plugin)
	end

	return vim.pack.add(processed_plugins, opts)
end

require("config.options")
require("config.keymaps")
require("config.autocmds")

-- Plugins
for file, _ in vim.fs.dir(vim.fn.stdpath("config") .. "/lua/plugins") do
	if file:match("%.lua$") then
		require("plugins." .. file:gsub("%.lua$", ""))
	end
end
