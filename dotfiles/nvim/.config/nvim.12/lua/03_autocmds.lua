local au = vim.api.nvim_create_autocmd
local ag = vim.api.nvim_create_augroup

require("colorpeek").setup()

-- Relative number off while typing, back on when leaving insert mode
au("InsertEnter", {
	group = ag("number_insert", { clear = true }),
	callback = function()
		vim.o.relativenumber = false
	end,
})

au("InsertLeave", {
	group = ag("number_normal", { clear = true }),
	callback = function()
		vim.o.relativenumber = true
	end,
})

-- Enable spell check for prose files
au("FileType", {
	group = ag("spell_files", { clear = true }),
	pattern = { "markdown", "gitcommit", "text" },
	callback = function()
		vim.opt_local.spell = true
	end,
})

-- Disable auto comment continuation on newlines
au("FileType", {
	group = ag("no_comment_continue", { clear = true }),
	callback = function()
		vim.opt_local.formatoptions:remove({ "c", "r", "o" })
	end,
})

-- Open help files in right vertical split
au("FileType", {
	group = ag("help_right", { clear = true }),
	pattern = "help",
	command = "wincmd L",
})

-- Clear command line after leaving it
au("CmdlineLeave", {
	group = ag("clear_cmdline", { clear = true }),
	callback = function()
		vim.defer_fn(function()
			if vim.fn.mode() == "n" then
				vim.cmd("echo ''")
			end
		end, 1500)
	end,
})
