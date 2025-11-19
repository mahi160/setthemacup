-- nvim.minimal: A clean, fast Neovim configuration for TypeScript development
-- Focused on essential productivity features without complexity

-- Track startup time for performance monitoring
if not vim.g.startup_time then
	vim.g.startup_time = vim.loop.hrtime()
end

-- Helper function to simplify plugin declarations
function pack(plugins, opts)
	opts = opts or { confirm = false }
	
	-- Handle single plugin or table of plugins
	local plugin_list = type(plugins) == "table" and plugins or { plugins }
	local processed_plugins = {}
	
	for _, plugin in ipairs(plugin_list) do
		-- If it doesn't start with http/git, assume it's a GitHub repo
		if not plugin:match("^https?://") and not plugin:match("^git@") then
			-- Add GitHub prefix if it's just "user/repo" format
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
