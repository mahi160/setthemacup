return {
  "nvim-telescope/telescope.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    { "nvim-telescope/telescope-fzf-native.nvim", build = "make" },
    "nvim-telescope/telescope-ui-select.nvim",
    "nvim-telescope/telescope-frecency.nvim",
    "kkharji/sqlite.lua",
  },

  config = function()
    local telescope = require("telescope")
    local builtin = require("telescope.builtin")
    local actions = require("telescope.actions")
    local themes = require("telescope.themes")

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
          filesize_limit = 0.5,
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
        ["ui-select"] = themes.get_dropdown(),
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
          },
        },
      },
    })

    -- load extensions safely
    pcall(telescope.load_extension, "ui-select")
    pcall(telescope.load_extension, "frecency")
    pcall(telescope.load_extension, "fzf")

    -- smarter file picker
    local function smart_files()
      local in_git = vim.fn.system("git rev-parse --is-inside-work-tree 2>/dev/null"):match("true")
      if in_git then
        builtin.git_files({ show_untracked = true })
      else
        builtin.find_files()
      end
    end

    local function frecency()
      telescope.extensions.frecency.frecency({
        workspace = "project",
        cwd = vim.loop.cwd(),
      })
    end

    local map = function(keys, func, desc)
      vim.keymap.set("n", keys, func, { desc = desc })
    end

    map("<leader><leader>", smart_files, "[S]earch [G]it or [A]ll files")
    map("<leader>sf", frecency, "[S]earch [F]recency")
    map("<leader>sb", builtin.buffers, "[S]earch [B]uffers")
    map("<leader>sw", builtin.grep_string, "[S]earch Current [W]ord")
    map("<leader>/", builtin.live_grep, "[S]earch by [G]rep")
    map("<leader>sr", builtin.resume, "[S]earch [R]esume")
    map("<leader>sk", builtin.keymaps, "[S]earch [K]eymaps")
    map("<leader>sd", builtin.diagnostics, "[S]earch [D]iagnostics")
    map("<leader>sh", builtin.help_tags, "[S]earch [H]elp")
    map("<leader>sm", builtin.man_pages, "[S]earch [M]an Pages")
    map("<leader>sn", function()
      builtin.find_files({ cwd = vim.fn.stdpath("config") })
    end, "[S]earch [N]eovim Config")
  end,
}
