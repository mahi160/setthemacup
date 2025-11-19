pack({
	"nvim-lua/plenary.nvim",
	"nvim-telescope/telescope.nvim",
	"nvim-telescope/telescope-fzf-native.nvim",
	"nvim-telescope/telescope-ui-select.nvim",
	"nvim-telescope/telescope-frecency.nvim",
	"tami5/sqlite.lua", -- required for frecency
})

local telescope = require("telescope")
local actions = require("telescope.actions")
local builtin = require("telescope.builtin")

telescope.setup({
	defaults = {
		prompt_prefix = "   ",
		selection_caret = " ",
		entry_prefix = " ",
		sorting_strategy = "ascending",
		layout_config = {
			horizontal = { prompt_position = "top", preview_width = 0.55 },
			width = 0.87,
			height = 0.80,
		},

		-- SPEED: Ignore massive folders to prevent indexing lag
		file_ignore_patterns = { "node_modules", "dist", "build", "%.git/", "%.lock" },
		path_display = { "truncate" },

		vimgrep_arguments = {
			"rg",
			"--color=never",
			"--no-heading",
			"--with-filename",
			"--line-number",
			"--column",
			"--smart-case",
			"--hidden",
			"--glob=!**/.git/*",
			"--glob=!**/node_modules/*",
		},

		preview = {
			filesize_limit = 0.1,
			timeout = 250,
			treesitter = false,
		},

		mappings = {
			n = { ["q"] = actions.close },
			i = {
				["<C-u>"] = false,
				["<C-d>"] = false,
			},
		},
	},

	extensions = {
		["ui-select"] = require("telescope.themes").get_dropdown(),

		fzf = {
			fuzzy = true,
			override_generic_sorter = true,
			override_file_sorter = true,
			case_mode = "smart_case",
		},

		["frecency"] = {
			show_scores = true,
			show_unindexed = true,
			ignore_patterns = { "*.git/*", "*/tmp/*", "*/node_modules/*" },
			disable_devicons = false,
			workspaces = {
				conf = vim.fn.stdpath("config"),
				data = vim.fn.stdpath("data"),
				project = vim.loop.cwd(),
			},
		},
	},
})

pcall(telescope.load_extension, "ui-select")
pcall(telescope.load_extension, "frecency")

local fzf_loaded, _ = pcall(telescope.load_extension, "fzf")
if not fzf_loaded then
	vim.notify(
		"Telescope FZF is installed but not compiled!\nRun 'make' in the plugin folder to fix the lag.",
		vim.log.levels.WARN
	)
	-- run below code to compile fzf-native.nvim
	-- cd /Users/mahi/.local/share/nvim.minimal/site/pack/core/opt/telescope-fzf-native.nvim && make
end

-- Smart git-aware file search
local function smart_files()
	local ok = pcall(builtin.git_files, { show_untracked = true })
	if not ok then
		builtin.find_files()
	end
end

-- Keymaps
vim.keymap.set("n", "<leader><leader>", smart_files, { desc = "[S]earch Files (Git or All)" })
vim.keymap.set("n", "<leader>sf", telescope.extensions.frecency.frecency, { desc = "[S]earch [F]recency" })
vim.keymap.set("n", "<leader>sb", builtin.buffers, { desc = "[S]earch [B]uffers" })
vim.keymap.set("n", "<leader>sw", builtin.grep_string, { desc = "[S]earch Current [W]ord" })
vim.keymap.set("n", "<leader>/", builtin.live_grep, { desc = "[S]earch by [G]rep" })
vim.keymap.set("n", "<leader>sr", builtin.resume, { desc = "[S]earch [R]esume" })
vim.keymap.set("n", "<leader>sk", builtin.keymaps, { desc = "[S]earch [K]eymaps" })
vim.keymap.set("n", "<leader>sd", builtin.diagnostics, { desc = "[S]earch [D]iagnostics" })
vim.keymap.set("n", "<leader>sh", builtin.help_tags, { desc = "[S]earch [H]elp" })
vim.keymap.set("n", "<leader>sm", builtin.man_pages, { desc = "[S]earch [M]an Pages" })
vim.keymap.set("n", "<leader>sn", function()
	builtin.find_files({ cwd = vim.fn.stdpath("config") })
end, { desc = "[S]earch [N]eovim Config" })
