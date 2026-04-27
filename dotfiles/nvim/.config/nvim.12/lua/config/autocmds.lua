-- Auto-clear command area after a short delay
vim.api.nvim_create_autocmd("CmdlineLeave", {
  group = vim.api.nvim_create_augroup("clear_cmdline", { clear = true }),
  desc = "Clear command output after delay",
  callback = function()
    vim.defer_fn(function()
      if vim.fn.mode() == "n" then
        vim.cmd("echo ''")
      end
    end, 2000)
  end,
})

-- Disable automatic comment continuation
vim.api.nvim_create_autocmd("FileType", {
  group = vim.api.nvim_create_augroup("no_auto_comment", { clear = true }),
  desc = "Disable auto comment on new line",
  callback = function()
    vim.opt_local.formatoptions:remove({ "c", "r", "o" })
  end,
})

-- Open help in vertical split (right side)
vim.api.nvim_create_autocmd("FileType", {
  group = vim.api.nvim_create_augroup("vertical_help", { clear = true }),
  pattern = "help",
  desc = "Open help in a vertical split",
  command = "wincmd L",
})

-- Plugins sync command
vim.api.nvim_create_user_command("Packsync", function()
  vim.notify("🔄 Syncing plugins...", vim.log.levels.INFO)

  local start_time = vim.loop.hrtime()
  local ok, result = pcall(vim.pack.update)
  local end_time = vim.loop.hrtime()
  local duration = (end_time - start_time) / 1000000 -- Convert to ms

  if ok then
    vim.notify(string.format("✅ Plugins synced successfully! (%.2fms)", duration), vim.log.levels.INFO)
  else
    vim.notify("❌ Plugin sync failed: " .. tostring(result), vim.log.levels.ERROR)
  end
end, {
  desc = "Sync (update) all plugins",
})
