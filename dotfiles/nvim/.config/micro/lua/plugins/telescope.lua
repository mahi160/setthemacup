-- Telescope (Fuzzy Finder) Configuration
-- Reference: :help telescope

vim.pack.add({
	"nvim-lua/plenary.nvim",
	"nvim-telescope/telescope.nvim",
	"nvim-telescope/telescope-fzf-native.nvim",
	"nvim-telescope/telescope-ui-select.nvim",
	"nvim-telescope/telescope-frecency.nvim",
	"tami5/sqlite.lua",
}, { confirm = false })

local telescope = require("telescope")
local actions = require("telescope.actions")
local builtin = require("telescope.builtin")

telescope.setup({
	defaults = {
		prompt_prefix = "   ",
		selection_caret = " ",
		entry_prefix = " ",
		sorting_strategy = "ascending",
		layout_config = {
			horizontal = { prompt_position = "top", preview_width = 0.55 },
			width = 0.87,
			height = 0.80,
		},

		-- Ignore massive folders to prevent indexing lag
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

		frecency = {
			show_scores = true,
			show_unindexed = true,
			ignore_patterns = { "*.git/*", "*/tmp/*", "*/node_modules/*" },
			disable_devicons = false,
			workspaces = {
				conf = vim.fn.stdpath("config"),
				data = vim.fn.stdpath("data"),
				project = vim.fn.getcwd(), -- Fixed: was vim.loop.cwd()
			},
		},
	},
})

-- Load extensions
pcall(telescope.load_extension, "ui-select")
pcall(telescope.load_extension, "frecency")

local fzf_loaded = pcall(telescope.load_extension, "fzf")
if not fzf_loaded then
	vim.notify(
		"Telescope FZF is installed but not compiled!\nRun 'make' in the plugin folder to fix lag.",
		vim.log.levels.WARN
	)
end

-- Keymaps
local keymap = vim.keymap.set

local function smart_files()
	local ok = pcall(builtin.git_files, { show_untracked = true })
	if not ok then
		builtin.find_files()
	end
end

keymap("n", "<leader><leader>", smart_files, { desc = "Search files (Git or all)" })
keymap("n", "<leader>sf", telescope.extensions.frecency.frecency, { desc = "Search frecency" })
keymap("n", "<leader>sb", builtin.buffers, { desc = "Search buffers" })
keymap("n", "<leader>sw", builtin.grep_string, { desc = "Search current word" })
keymap("n", "<leader>/", builtin.live_grep, { desc = "Search by grep" })
keymap("n", "<leader>sr", builtin.resume, { desc = "Search resume" })
keymap("n", "<leader>sk", builtin.keymaps, { desc = "Search keymaps" })
keymap("n", "<leader>sd", builtin.diagnostics, { desc = "Search diagnostics" })
keymap("n", "<leader>sh", builtin.help_tags, { desc = "Search help" })
keymap("n", "<leader>sm", builtin.man_pages, { desc = "Search man pages" })
keymap("n", "<leader>sn", function()
	builtin.find_files({ cwd = vim.fn.stdpath("config") })
end, { desc = "Search Neovim config" })
