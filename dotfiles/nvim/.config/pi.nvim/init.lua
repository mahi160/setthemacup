-------- OPTIONS --------
vim.g.mapleader = " "
vim.g.maplocalleader = " "
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.signcolumn = "yes:1"
vim.opt.wrap = true
vim.opt.confirm = true
vim.opt.expandtab = true
vim.opt.shiftwidth = 2
vim.opt.tabstop = 2
vim.opt.softtabstop = 2

vim.opt.spell = true
vim.opt.spelllang = "en_us"
vim.opt.spellfile = vim.fn.stdpath("config") .. "/spell/en.utf-8.add"
vim.fn.mkdir(vim.fn.stdpath("config") .. "/spell", "p")

-------- KEYMAPS --------
local map = vim.keymap.set
map("n", "-", "<CMD>Oil<CR>", { desc = "Open parent directory with Oil" })
map("i", "jj", "<Esc>", { desc = "Escape to Normal mode" })
map("n", "<leader>qq", ":qa!<cr>", { desc = "Quit all" })
map("n", "H", "<cmd>:bn<cr>", { desc = "Next buffer" })
map("n", "L", "<cmd>:bp<cr>", { desc = "Previous buffer" })
map("n", "J", function()
  local last = vim.fn.bufnr("#")
  if last > 0 and vim.api.nvim_buf_is_loaded(last) and vim.bo[last].buflisted then
    vim.cmd("buffer " .. last)
  end
end, { desc = "Toggle last buffer" })
map({ "n", "v" }, "<leader>y", '"+y', { desc = "Yank to clipboard" })
map({ "n", "v" }, "<leader>p", '"+p', { desc = "Paste from clipboard" })
map({ "n", "v" }, "<leader>d", '"_d', { desc = "Delete to void register" })
map("n", "<C-d>", "<C-d>zz", { desc = "Scroll down centered" })
map("n", "<C-u>", "<C-u>zz", { desc = "Scroll up centered" })
map("n", "n", "nzzzv", { desc = "Next search centered" })
map("n", "N", "Nzzzv", { desc = "Prev search centered" })
map("n", "<Esc>", "<cmd>nohlsearch<cr>", { desc = "Clear search highlight" })
map("n", "<leader>a", "ggVG", { desc = "Select all" })
map("v", "<", "<gv", { desc = "Indent left" })
map("v", ">", ">gv", { desc = "Indent right" })

-------- AUTOCOMMANDS --------

-- Auto format on save for LSP clients that support formatting
vim.api.nvim_create_autocmd("LspAttach", {
  group = vim.api.nvim_create_augroup("lsp_format", { clear = true }),
  callback = function(ev)
    local client = vim.lsp.get_clients({ id = ev.data.client_id })[1]
    if not client then
      return
    end

    if client:supports_method("textDocument/formatting") then
      vim.api.nvim_create_autocmd("BufWritePre", {
        group = vim.api.nvim_create_augroup("lsp_format_buffer", { clear = false }),
        buffer = ev.buf,
        callback = function()
          vim.lsp.buf.format({ bufnr = ev.buf, id = client.id, timeout_ms = 1000 })
        end,
      })
    end
  end,
})

-------- PLUGINS --------

-- AI Completion (Supermaven)
vim.pack.add({ "https://github.com/supermaven-inc/supermaven-nvim" }, { confirm = false })
require("supermaven-nvim").setup({})

-- Colorscheme (Everforest)
vim.pack.add({ "https://github.com/sainnhe/everforest" }, { confirm = false })
vim.g.everforest_enable_italic = 1
vim.g.everforest_better_performance = 1
vim.g.everforest_background = "hard"
vim.g.everforest_transparent_background = 2
vim.cmd.colorscheme("everforest")

-- Diagnostics (Tiny Inline Diagnostic)
vim.pack.add({ "https://github.com/rachartier/tiny-inline-diagnostic.nvim" }, { confirm = false })
require("tiny-inline-diagnostic").setup({
  preset = "ghost",
})
vim.diagnostic.config({
  virtual_text = false,
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = " ",
      [vim.diagnostic.severity.WARN] = " ",
      [vim.diagnostic.severity.INFO] = " ",
      [vim.diagnostic.severity.HINT] = " ",
    },
  },
})

-- LSP Configuration
vim.pack.add({
  "https://github.com/neovim/nvim-lspconfig",
  "https://github.com/mason-org/mason.nvim",
  "https://github.com/mason-org/mason-lspconfig.nvim",
}, { confirm = false })

local servers = {
  html = {},
  cssls = {},
  tailwindcss = {},
  jsonls = {},
  vtsls = {
    settings = {
      typescript = { preferences = { importModuleSpecifier = "relative" } },
      typescriptreact = { preferences = { importModuleSpecifier = "relative" } },
      javascript = { preferences = { importModuleSpecifier = "relative" } },
      javascriptreact = { preferences = { importModuleSpecifier = "relative" } },
    },
  },
  eslint = {
    settings = {
      workingDirectory = { mode = "auto" },
    },
  },
  gopls = {
    settings = {
      gopls = {
        analyses = { unusedparams = true },
        staticcheck = true,
      },
    },
  },
  lua_ls = {
    settings = {
      Lua = {
        workspace = { library = vim.api.nvim_get_runtime_file("lua", true) },
      },
    },
  },
  harper_ls = {
    settings = {
      ["harper-ls"] = {
        linters = { SpellCheck = true },
        isolateToEnglish = true,
      },
    },
  },
}

require("mason").setup()
require("mason-lspconfig").setup({
  ensure_installed = vim.tbl_keys(servers),
  automatic_enable = true,
})

-- Set base capabilities FIRST so they merge into all server configs
vim.lsp.config("*", {
  capabilities = vim.lsp.protocol.make_client_capabilities(),
})

for server_name, config in pairs(servers) do
  vim.lsp.config(server_name, config)
end

for server_name in pairs(servers) do
  vim.lsp.enable(server_name)
end

-- Mini.nvim
vim.pack.add({ "https://github.com/nvim-mini/mini.nvim" }, { confirm = false })
require("mini.ai").setup()
require("mini.basics").setup()
require("mini.diff").setup()
require("mini.icons").setup()
require("mini.indentscope").setup()
require("mini.move").setup()
require("mini.notify").setup()
require("mini.pairs").setup()
require("mini.snippets").setup()
require("mini.statusline").setup()
require("mini.surround").setup()

-- Highlight TODOs (Todo Comments)
vim.pack.add({ "https://github.com/folke/todo-comments.nvim" }, { confirm = false })
require("todo-comments").setup({})

-- Code Metrics (Wakatime)
vim.pack.add({ "https://github.com/wakatime/vim-wakatime" }, { confirm = false })

-- File Explorer (Oil.nvim)
vim.pack.add({ "https://github.com/stevearc/oil.nvim" }, { confirm = false })
require("oil").setup({
  default_file_explorer = true,
  delete_to_trash = true,
  skip_confirm_for_simple_edits = true,
  view_options = {
    show_hidden = true,
  },
})

-- Telescope (Fuzzy Finder)
vim.pack.add({
  "https://github.com/nvim-lua/plenary.nvim",
  "https://github.com/nvim-telescope/telescope.nvim",
  "https://github.com/nvim-telescope/telescope-fzf-native.nvim",
  "https://github.com/nvim-telescope/telescope-ui-select.nvim",
  "https://github.com/nvim-telescope/telescope-frecency.nvim",
  "https://github.com/tami5/sqlite.lua",
}, { confirm = false })

local telescope = require("telescope")
local fzf_loaded, _ = pcall(telescope.load_extension, "fzf")
if not fzf_loaded then
  vim.notify(
    "Telescope FZF is installed but not compiled!\nRun 'make' in the plugin folder to fix the lag.",
    vim.log.levels.WARN
  )
  -- run below code to compile fzf-native.nvim
  -- cd /Users/mahi/.local/share/nvim.minimal/site/pack/core/opt/telescope-fzf-native.nvim && make
end

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
        project = vim.fn.getcwd(),
      },
    },
  },
})

pcall(telescope.load_extension, "ui-select")
pcall(telescope.load_extension, "frecency")

local fzf_loaded = pcall(telescope.load_extension, "fzf")
if not fzf_loaded then
  vim.notify(
    "Telescope FZF is installed but not compiled!\nRun 'make' in the plugin folder to fix lag.",
    vim.log.levels.WARN
  )
end

-- Telescope keymaps
local function smart_files()
  local ok = pcall(builtin.git_files, { show_untracked = true })
  if not ok then
    builtin.find_files()
  end
end

map("n", "<leader><leader>", smart_files, { desc = "Search files (Git or all)" })
map("n", "<leader>sf", telescope.extensions.frecency.frecency, { desc = "Search frecency" })
map("n", "<leader>sb", builtin.buffers, { desc = "Search buffers" })
map("n", "<leader>sw", builtin.grep_string, { desc = "Search current word" })
map("n", "<leader>/", builtin.live_grep, { desc = "Search by grep" })
map("n", "<leader>sr", builtin.resume, { desc = "Search resume" })
map("n", "<leader>sk", builtin.keymaps, { desc = "Search keymaps" })
map("n", "<leader>sd", builtin.diagnostics, { desc = "Search diagnostics" })
map("n", "<leader>sh", builtin.help_tags, { desc = "Search help" })
map("n", "<leader>sm", builtin.man_pages, { desc = "Search man pages" })
map("n", "<leader>sn", function()
  builtin.find_files({ cwd = vim.fn.stdpath("config") })
end, { desc = "Search Neovim config" })

-- Treesitter
vim.pack.add({ "https://github.com/nvim-treesitter/nvim-treesitter" }, { confirm = false })
require("nvim-treesitter").setup({
  ensure_installed = {},
  sync_install = false,
  auto_install = true,
  modules = {},
  ignore_install = {},

  highlight = {
    enable = true,
  },

  indent = {
    enable = true,
  },

  incremental_selection = {
    enable = true,
    keymaps = {
      init_selection = "<CR>",
      node_incremental = "<CR>",
      node_decremental = "<BS>",
      scope_incremental = false,
    },
  },
})
