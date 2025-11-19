-- Highlight selection after yank
vim.api.nvim_create_autocmd("TextYankPost", {
	group = vim.api.nvim_create_augroup("highlight_yank", { clear = true }),
	desc = "Highlight selection on yank",
	callback = function()
		vim.highlight.on_yank({ timeout = 200, visual = true })
	end,
})

-- Show cursorline only in active window
vim.api.nvim_create_autocmd({ "WinLeave", "BufLeave" }, {
	group = vim.api.nvim_create_augroup("active_cursorline", { clear = true }),
	desc = "Hide cursorline when window loses focus",
	callback = function()
		vim.opt_local.cursorline = false
	end,
})

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

-- Restore cursor position to last known location
vim.api.nvim_create_autocmd("BufReadPost", {
	group = vim.api.nvim_create_augroup("restore_cursor", { clear = true }),
	desc = "Restore last cursor position",
	callback = function(args)
		local mark = vim.api.nvim_buf_get_mark(args.buf, '"')
		local line_count = vim.api.nvim_buf_line_count(args.buf)
		if mark[1] > 0 and mark[1] <= line_count then
			vim.api.nvim_win_set_cursor(0, mark)
			vim.schedule(function()
				vim.cmd("normal! zz")
			end)
		end
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

-- Automatically resize splits when terminal window is resized
vim.api.nvim_create_autocmd("VimResized", {
	group = vim.api.nvim_create_augroup("auto_resize_splits", { clear = true }),
	desc = "Auto equalize window splits on resize",
	command = "wincmd =",
})

-- Plugins sync command
vim.api.nvim_create_user_command("Sync", function()
	vim.notify("🔄 Syncing plugins...", vim.log.levels.INFO)

	local start_time = vim.loop.hrtime()
	local ok, result = pcall(vim.pack.update, { confirm = false })
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
