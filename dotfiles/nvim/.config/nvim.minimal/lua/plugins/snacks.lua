Pack("folke/snacks.nvim")

local function get_project_root()
	local root_markers = { ".git", "package.json", "Cargo.toml", "pyproject.toml", "Makefile" }
	local start_path = vim.api.nvim_buf_get_name(0)
	local root = vim.fs.find(root_markers, {
		up = true,
		stop = vim.loop.os_homedir(),
		path = start_path,
	})[1]

	if root then
		return vim.fs.dirname(root)
	else
		return vim.fn.getcwd()
	end
end

require("snacks").setup({
	opts = {
		bigfiles = {
			enabled = true,
		},
		pcikers = {
			matcher = {
				frecency = true,
			},
		},
	},
})

local p = require("snacks").picker

local function find_files_in_root()
	local root_dir = get_project_root()
	p.files({
		cwd = root_dir,
	})
end

local function grep_in_root()
	local root_dir = get_project_root()
	p.grep({
		cwd = root_dir,
	})
end

vim.keymap.set("n", "<leader><space>", find_files_in_root, { desc = "[S]mart [F]ile (Root)" })
vim.keymap.set("n", "<leader>ff", find_files_in_root, { desc = "[F]ind [F]iles (Root)" })
vim.keymap.set("n", "<leader>/", grep_in_root, { desc = "[G]rep (Root)" })
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
