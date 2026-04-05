-- Core Keymaps
local map = vim.keymap.set

-- File explorer
map("n", "-", "<CMD>Oil<CR>", { desc = "Open parent directory with Oil" })

-- Escape insert mode
map("i", "jj", "<Esc>", { desc = "Escape to Normal mode" })

-- Buffer navigation
map("n", "H", "<cmd>:bn<cr>", { desc = "Next buffer" })
map("n", "L", "<cmd>:bp<cr>", { desc = "Previous buffer" })
map("n", "J", function()
	local last = vim.fn.bufnr("#")
	if last > 0 and vim.api.nvim_buf_is_loaded(last) and vim.bo[last].buflisted then
		vim.cmd("buffer " .. last)
	end
end, { desc = "Toggle last buffer" })
