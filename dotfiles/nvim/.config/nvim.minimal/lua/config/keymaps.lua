local map = vim.keymap.set

map("n", "<Esc>", "<cmd>nohlsearch<CR>", { desc = "Clear search highlights" })
map("n", "-", "<CMD>Oil<CR>", { desc = "Open parent directory" })
map("n", "<leader>qq", "<cmd>qa<CR>", { desc = "Quit all" })

map("n", "H", "<cmd>bprevious<CR>", { desc = "Previous buffer" })
map("n", "L", "<cmd>bnext<CR>", { desc = "Next buffer" })
map("n", "J", function()
	local last = vim.fn.bufnr("#")
	if last > 0 and vim.api.nvim_buf_is_loaded(last) and vim.bo[last].buflisted then
		vim.cmd("buffer " .. last)
	end
end, { desc = "Switch to last open buffer" })

map("n", "<leader>bo", function()
	local current = vim.api.nvim_get_current_buf()
	for _, buf in ipairs(vim.api.nvim_list_bufs()) do
		if buf ~= current and vim.api.nvim_buf_is_loaded(buf) and vim.bo[buf].buflisted then
			if not vim.bo[buf].modified then
				pcall(vim.api.nvim_buf_delete, buf, {})
			end
		end
	end
end, { desc = "Delete other non-modified buffers" })

map("n", "[d", vim.diagnostic.goto_prev, { desc = "Previous diagnostic" })
map("n", "]d", vim.diagnostic.goto_next, { desc = "Next diagnostic" })
map("n", "<leader>cd", function()
	vim.diagnostic.enable(not vim.diagnostic.is_enabled())
end, { desc = "Toggle diagnostics" })

map({ "n", "i", "v" }, "<D-s>", "<Esc><cmd>write<cr>", { desc = "Save file" })
