return {
  "nvim-telescope/telescope.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-telescope/telescope-fzf-native.nvim",
    "nvim-telescope/telescope-ui-select.nvim",
    "nvim-telescope/telescope-frecency.nvim",
    "tami5/sqlite.lua", 
  },
  build = "make",

  opts = {
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
      find_command = { "fd", "--type", "f", "--strip-cwd-prefix", "--hidden", "--exclude", ".git" },
      file_ignore_patterns = { "node_modules", "dist", "build", "%.git/", "%.lock" },
      path_display = { "smart" },
      vimgrep_arguments = {
        "rg", "--color=never", "--no-heading", "--with-filename", "--line-number", "--column", "--smart-case", "--hidden", "--glob=!**/.git/*", "--glob=!**/node_modules/*",
      },
      preview = {
        filesize_limit = 0.1,
        timeout = 250,
        treesitter = false,
      },
      mappings = {
        n = { ["q"] = "close" },
        i = {
          ["<C-u>"] = false,
          ["<C-d>"] = false,
          ["<C-j>"] = "move_selection_next",
          ["<C-k>"] = "move_selection_previous",
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
        default_workspace = "CWD",
        show_scores = false,
        show_unindexed = true,
        ignore_patterns = { "*.git/*", "*/node_modules/*", "*/dist/*" },
      },
    },
  },

  config = function(_, opts)
    local telescope = require("telescope")
    local builtin = require("telescope.builtin")
    telescope.setup(opts)

    pcall(telescope.load_extension, "ui-select")
    pcall(telescope.load_extension, "frecency")
    pcall(telescope.load_extension, "fzf")

    -- Mappings
    vim.keymap.set("n", "<leader><leader>", function()
      telescope.extensions.frecency.frecency({ workspace = "CWD" })
    end, { desc = "Smart Search (Frecency)" })
    
    vim.keymap.set("n", "<leader>/", builtin.live_grep, { desc = "Grep Project" })
    vim.keymap.set("n", "<leader>sw", builtin.grep_string, { desc = "Search Word under cursor" })
    vim.keymap.set("n", "<leader>sb", builtin.buffers, { desc = "Search Buffers" })
    vim.keymap.set("n", "<leader>sr", builtin.resume, { desc = "Resume Last Search" })
    vim.keymap.set("n", "<leader>sd", builtin.diagnostics, { desc = "Search Diagnostics" })
    
    vim.keymap.set("n", "<leader>sn", function()
      builtin.find_files({ cwd = vim.fn.stdpath("config") })
    end, { desc = "Search Neovim Config" })
  end,
}
