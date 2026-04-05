-- Plugin Manager Setup
-- Each plugin file handles its own vim.pack.add() and setup

local plugins_dir = vim.fn.stdpath("config") .. "/lua/plugins"

for name in vim.fs.dir(plugins_dir) do
	if name:match("%.lua$") and name ~= "init.lua" then
		local plugin_name = name:gsub("%.lua$", "")
		local ok, err = pcall(require, "plugins." .. plugin_name)
		if not ok then
			vim.notify("Failed to load plugin '" .. plugin_name .. "': " .. tostring(err), vim.log.levels.ERROR)
		end
	end
end
