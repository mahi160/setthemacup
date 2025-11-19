-- nvim.minimal: A clean, fast Neovim configuration for TypeScript development
-- Focused on essential productivity features without complexity

require("config.options")
require("config.keymaps")
require("config.autocmds")

-- Plugins
for file, _ in vim.fs.dir(vim.fn.stdpath("config") .. "/lua/plugins") do
	if file:match("%.lua$") then
		require("plugins." .. file:gsub("%.lua$", ""))
	end
end
