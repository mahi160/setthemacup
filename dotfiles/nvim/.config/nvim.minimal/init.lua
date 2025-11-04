--- Configs
for file, _ in vim.fs.dir(vim.fn.stdpath("config") .. "/lua/config") do
  if file:match("%.lua$") then
    require("config." .. file:gsub("%.lua$", ""))
  end
end

-- Plugins
for file, _ in vim.fs.dir(vim.fn.stdpath("config") .. "/lua/plugins") do
  if file:match("%.lua$") then
    require("plugins." .. file:gsub("%.lua$", ""))
  end
end

-- Uncomment to enable automatic plugin updates
-- vim.pack.update()
