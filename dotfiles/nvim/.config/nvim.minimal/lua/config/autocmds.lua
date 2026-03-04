local function update_plugins()
  local names = vim.iter(vim.pack.get())
    :filter(function(pkg)
      if not pkg.spec then
        return false
      end
      if not pkg.spec.name then
        return false
      end
      if not pkg.spec.url and not pkg.spec.src then
        return false
      end
      return true
    end)
    :map(function(pkg)
      return pkg.spec.name
    end)
    :totable()

  if #names == 0 then
    vim.notify("⚠️ No updateable plugins found (checked " .. #vim.pack.get() .. " items).", vim.log.levels.WARN)
    return
  end

  table.sort(names)

  vim.notify("🔄 Updating " .. #names .. " plugins...", vim.log.levels.INFO)
  vim.pack.update(names, { async = true })
end

vim.api.nvim_create_user_command("Packsync", function()
  vim.notify("🔄 Syncing plugins...", vim.log.levels.INFO)

  local start_time = vim.loop.hrtime()
  local ok, result = pcall(update_plugins)
  local end_time = vim.loop.hrtime()
  local duration = (end_time - start_time) / 1000000

  if ok then
    vim.notify(string.format("✅ Plugins synced successfully! (%.2fms)", duration), vim.log.levels.INFO)
  else
    vim.notify("❌ Plugin sync failed: " .. tostring(result), vim.log.levels.ERROR)
  end
end, {
  desc = "Sync (update) all plugins",
})
