require("config.options")
require("config.keymap")

-- Plugins
for file, _ in vim.fs.dir(vim.fn.stdpath("config") .. "/lua/plugins") do
  if file:match("%.lua$") then
    require("plugins." .. file:gsub("%.lua$", ""))
  end
end

-- uncomment to enable automatic plugin updates
-- vim.pack.update()
