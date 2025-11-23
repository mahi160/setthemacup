Pack("folke/snacks.nvim")
local get_custom_layout = function(height)
	return {
		reverse = true,
		layout = {
			box = "vertical",
			backdrop = false,
			row = -1,
			width = 0,
			height = height or 0.4,
			border = "none",
			{
				box = "horizontal",
				{ win = "list", title = "{title}", title_pos = "center", border = "rounded" },
				{ win = "preview", title = "{preview}", width = 0.6, border = "rounded" },
			},
			{ win = "input", height = 1, border = "none" },
		},
	}
end

require("snacks").setup({
	opts = {
		pcikers = {
			matcher = {
				frecency = true,
			},
			layout = "custom",
			layouts = {
				custom = get_custom_layout(),
				select = {
					hidden = { "preview" },
					layout = get_custom_layout().layout,
				},
			},
		},
	},
})

local p = Snacks.picker
vim.keymap.set("n", "<leader><space>", function()
	p.buffers()
end, { desc = "[S]mart [F]ile" })
vim.keymap.set("n", "<leader>/", function()
	p.grep()
end, { desc = "[G]rep" })
vim.keymap.set("n", "<leader>n", function()
	p.notifications()
end, { desc = "[N]otification History" })
vim.keymap.set("n", "<leader>l", function()
	p.lines()
end, { desc = "[L]ines" })
vim.keymap.set({ "n", "x" }, "<leader>w", function()
	p.grep_word()
end, { desc = "Visual selection or [W]ord" })
vim.keymap.set("n", "<leader>fb", function()
	p.buffers()
end, { desc = "[F]ind [B]uffers" })
vim.keymap.set("n", "<leader>fc", function()
	p.files({ cwd = vim.fn.stdpath("config") })
end, { desc = "[F]ind [C]onfig File" })
vim.keymap.set("n", "<leader>ff", function()
	p.files()
end, { desc = "[F]ind [F]iles" })
vim.keymap.set("n", "<leader>fg", function()
	p.git_files()
end, { desc = "[F]ind [G]it Files" })
vim.keymap.set("n", "<leader>fp", function()
	p.projects()
end, { desc = "[F]ind [P]rojects" })
vim.keymap.set("n", "<leader>fr", function()
	p.recent()
end, { desc = "[F]ind [R]ecent" })
vim.keymap.set("n", "<leader>ft", function()
	p.treesitter()
end, { desc = "[F]ind [T]reesitter" })
vim.keymap.set("n", "<leader>fm", function()
	p.marks()
end, { desc = "[F]ind [M]arks" })
vim.keymap.set("n", "<leader>fk", function()
	p.keymaps()
end, { desc = "[F]ind [K]eymaps" })
vim.keymap.set("n", "<leader>fd", function()
	p.diagnostics()
end, { desc = "[F]ind [D]iagnostics" })
