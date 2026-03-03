-- Options
vim.g.mapleader = " "                                                 -- Global leader key
vim.g.maplocalleader = " "                                            -- Local leader key
vim.opt.number = true                                                 -- Show line numbers
vim.opt.relativenumber = true                                         -- Relative line numbers
vim.opt.signcolumn = "yes"                                            -- Always show sign column
vim.opt.cursorline = true                                             -- Highlight current line
vim.opt.wrap = true                                                   -- Wrap long lines
vim.opt.winborder = "rounded"                                         -- Rounded popup borders
vim.opt.scrolloff = 12                                                -- Context lines above/below cursor
vim.opt.showmode = false                                              -- Hide mode indicator
vim.opt.timeoutlen = 300                                              -- Keymap timeout
vim.opt.updatetime = 250                                              -- Faster diagnostics
vim.opt.ignorecase = true                                             -- Case-insensitive search...
vim.opt.smartcase = true                                              -- ...unless uppercase in pattern
vim.opt.inccommand = "split"                                          -- Live preview (default: nosplit)
vim.opt.clipboard = "unnamedplus"                                     -- System clipboard
vim.opt.breakindent = true                                            -- Preserve indent on wrapped lines
vim.opt.swapfile = false                                              -- Disable swap files
vim.opt.autowrite = true                                              -- Auto-save when switching buffers
vim.g.autoformat = true                                               -- Custom: enable auto-formatting
vim.opt.tabstop = 2                                                   -- Tab width (display)
vim.opt.shiftwidth = 2                                                -- Indent width
vim.opt.expandtab = true                                              -- Convert tabs to spaces
vim.opt.textwidth = 120                                               -- Auto-wrap at 120 columns
vim.opt.pumheight = 10                                                -- Limit completion menu height
vim.opt.shortmess:append("WIcC")                                      -- Reduce message clutter
vim.opt.formatoptions:remove({ "c", "r", "o" })                       -- Don't auto-continue comments
vim.opt.spell = false                                                 -- Spelling disabled by default
vim.opt.spelllang = "en_us"                                           -- Spelling language
vim.opt.spellfile = vim.fn.stdpath("config") .. "/spell/en.utf-8.add" -- Custom words file
vim.opt.foldlevelstart = 99                                           -- Start with all folds open
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"

-- Keybinds
vim.keymap.set("n", "-", "<CMD>Oil<CR>", { desc = "[O]pen parent directory" })
vim.keymap.set('i', 'jj', '<Esc>', { desc = "[E]scape to normal mode" })
vim.keymap.set('n', '<D-s>', '<cmd>write<cr>', { desc = 'Save file' })
vim.keymap.set('i', '<D-s>', '<Esc><cmd>write<cr>', { desc = 'Save and exit insert' })
vim.keymap.set('v', '<D-s>', '<Esc><cmd>write<cr>', { desc = 'Save and exit visual' })


-- Autocmds
-- Auto format on save
vim.api.nvim_create_autocmd("BufWritePre", {
  pattern = "*",
  callback = function()
    if vim.g.autoformat then
      local bufnr = vim.api.nvim_get_current_buf()
      local clients = vim.lsp.get_clients({ bufnr = bufnr })
      if #clients > 0 then
        vim.lsp.buf.format({ async = false, bufnr = bufnr })
      end
    end
  end
})

-- Plugins
vim.pack.add({
  "https://github.com/nvim-mini/mini.nvim",
  "https://github.com/stevearc/oil.nvim",
  "https://github.com/neovim/nvim-lspconfig",
  "https://github.com/mason-org/mason.nvim",
  "https://github.com/mason-org/mason-lspconfig.nvim",
  "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim",
  "https://github.com/rachartier/tiny-inline-diagnostic.nvim",
  "https://github.com/folke/snacks.nvim",
  "https://github.com/nvim-treesitter/nvim-treesitter",
  "https://github.com/L3MON4D3/LuaSnip",
  "https://github.com/rafamadriz/friendly-snippets",
  "https://github.com/zbirenbaum/copilot.lua",
  "https://github.com/giuxtaposition/blink-cmp-copilot",
})
vim.pack.add({ { src = "https://github.com/saghen/blink.cmp", version = "1.*" } })

-- Treesitter
local ts_ok, ts_configs = pcall(require, "nvim-treesitter.configs")
if ts_ok then
  ts_configs.setup({
    ensure_installed = {
      "lua", "typescript", "tsx", "javascript", "go",
      "html", "css", "json", "markdown", "vim", "vimdoc", "query"
    },
    auto_install = true,           -- Auto-install missing parsers
    highlight = { enable = true }, -- Syntax highlighting
    indent = { enable = true },    -- Smart indentation
    incremental_selection = {
      enable = true,
      keymaps = {
        init_selection = "<CR>",    -- Start selection
        scope_incremental = "<CR>", -- Expand selection
        node_decremental = "<BS>",  -- Shrink selection
      },
    },
  })
end

-- LSP
require("mason").setup()
require("mason-lspconfig").setup()

-- Completion
local cmp_ok, blink = pcall(require, "blink.cmp")
if cmp_ok then
  blink.setup({
    keymap = { preset = "default" },
    sources = {
      default = { "lsp", "path", "snippets", "buffer" },
    },
    snippets = {
      preset = "luasnip",
    },
  })
end

-- Statusline
require("mini.statusline").setup()

-- Textobjects (treesitter-powered)
local ai_ok, ai = pcall(require, "mini.ai")
if ai_ok then
  local ts_spec = ai.gen_spec.treesitter
  ai.setup({
    custom_textobjects = {
      f = ts_spec({ a = "@function.outer", i = "@function.inner" }),
      c = ts_spec({ a = "@class.outer", i = "@class.inner" }),
      o = ts_spec({
        a = { "@conditional.outer", "@loop.outer" },
        i = { "@conditional.inner", "@loop.inner" },
      }),
      b = ts_spec({ a = "@block.outer", i = "@block.inner" }),
      k = ts_spec({ a = "@call.outer", i = "@call.inner" }),
      p = ts_spec({ a = "@parameter.outer", i = "@parameter.inner" }),
    },
  })
end

-- UI
require("mini.animate").setup()
require("mini.diff").setup()

-- File manager
require("oil").setup({
  default_file_explorer = true,
  delete_to_trash = true,
  skip_confirm_for_simple_edits = true,
  view_options = {
    show_hidden = true,
  },
})

-- Colorscheme
vim.cmd("colorscheme habamax")

-- Fuzzy finder
require("snacks").setup({
  picker = {
    enabled = true,
    ui_select = true,
  },
})
vim.keymap.set("n", "<leader><leader>", function() Snacks.picker.files() end)
vim.keymap.set("n", "<leader>/", function() Snacks.picker.grep() end)
vim.keymap.set("n", "<leader>fb", function() Snacks.picker.buffers() end)
vim.keymap.set("n", "<leader>fr", function() Snacks.picker.recent() end)
vim.keymap.set("n", "<leader>fw", function() Snacks.picker.grep_word() end)
vim.keymap.set("n", "<leader>fc", function()
  Snacks.picker.files({ cwd = vim.fn.stdpath("config") })
end, { desc = "[F]ind [C]onfig File" })

-- Extras
require("extras.options")
require("extras.lsp")
require("extras.diagnostics")
require("extras.colorscheme")
require("extras.completion")
require("extras.ai")
