-- Clear search highlights with <Esc>
vim.keymap.set("n", "<Esc>", "<cmd>nohlsearch<CR>", { desc = "Clear search highlights" })

-- Helper for keymap options
local map = vim.keymap.set
local opts = function(desc)
	return { silent = true, noremap = true, desc = desc }
end

-- Save buffer (Ctrl+S in all main modes)
map({ "n", "i", "v", "x", "s" }, "<C-s>", function()
	if vim.bo.modified then
		vim.cmd.write()
	end
	vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<Esc>", true, false, true), "n", false)
end, opts("Save buffer"))

-- Quit all
map("n", "<leader>qq", "<cmd>qa<CR>", opts("Quit all"))

-- Window navigation
map("n", "<C-h>", "<C-w>h", opts("Move to window left"))
map("n", "<C-j>", "<C-w>j", opts("Move to window down"))
map("n", "<C-k>", "<C-w>k", opts("Move to window up"))
map("n", "<C-l>", "<C-w>l", opts("Move to window right"))

-- Buffer navigation
map("n", "H", "<cmd>bprevious<CR>", opts("Previous buffer"))
map("n", "L", "<cmd>bnext<CR>", opts("Next buffer"))
map("n", "J", function()
	local last = vim.fn.bufnr("#") -- alternate buffer
	if last > 0 and vim.api.nvim_buf_is_loaded(last) and vim.bo[last].buflisted then
		vim.cmd("buffer " .. last)
	end
end, opts("Switch to last open buffer"))

-- Close current buffer safely
map("n", "<leader>bd", function()
	-- If only one buffer, just wipe it
	if #vim.fn.getbufinfo({ buflisted = 1 }) == 1 then
		vim.cmd("bdelete")
		return
	end

	-- Go to alternate buffer before closing
	local alt = vim.fn.bufnr("#")
	if alt > 0 and vim.api.nvim_buf_is_valid(alt) then
		vim.cmd("buffer #")
	else
		vim.cmd("bnext")
	end
	vim.cmd("bdelete #")
end, opts("Delete current buffer"))

-- Delete all other non-modified buffers
map("n", "<leader>bo", function()
	local current = vim.api.nvim_get_current_buf()
	for _, buf in ipairs(vim.api.nvim_list_bufs()) do
		if buf ~= current and vim.api.nvim_buf_is_loaded(buf) and vim.bo[buf].buflisted then
			if not vim.bo[buf].modified then
				pcall(vim.api.nvim_buf_delete, buf, {})
			end
		end
	end
end, opts("Delete other non-modified buffers"))
