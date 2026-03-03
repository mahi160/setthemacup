-- Options
vim.g.mapleader = " "             -- Global leader key
vim.g.maplocalleader = " "        -- Local leader key
vim.opt.termguicolors = true      -- Enable 24-bit colors
vim.opt.number = true             -- Show line numbers
vim.opt.relativenumber = true     -- Relative line numbers
vim.opt.signcolumn = "yes"        -- Always show sign column
vim.opt.cursorline = true         -- Highlight current line
vim.opt.wrap = true               -- Wrap long lines
vim.opt.winborder = "rounded"     -- Rounded popup borders
vim.opt.scrolloff = 12            -- Context lines above/below cursor
vim.opt.mouse = "a"               -- Enable mouse support
vim.opt.showmode = false          -- Hide mode indicator
vim.opt.splitright = true         -- Vertical splits go right
vim.opt.splitbelow = true         -- Horizontal splits go below
vim.opt.timeoutlen = 300          -- Keymap timeout
vim.opt.updatetime = 250          -- Faster diagnostics
vim.opt.ignorecase = true         -- Case-insensitive search...
vim.opt.smartcase = true          -- ...unless uppercase in pattern
vim.opt.hlsearch = true           -- Highlight search results
vim.opt.inccommand = "split"      -- Live substitution preview
vim.opt.clipboard = "unnamedplus" -- System clipboard
vim.opt.breakindent = true        -- Preserve indent on wrapped lines
vim.opt.undofile = true           -- Persistent undo
vim.opt.swapfile = false          -- Disable swap files
vim.opt.autowrite = true          -- Auto-save when switching buffers
vim.g.autoformat = true           -- Custom: enable auto-formatting
vim.opt.tabstop = 2               -- Tab width (display)
vim.opt.shiftwidth = 2            -- Indent width
vim.opt.expandtab = true          -- Convert tabs to spaces
vim.opt.textwidth = 120           -- Auto-wrap at 120 columns
vim.opt.completeopt = { "menu", "menuone", "noselect" } -- Better completion
vim.opt.pumheight = 10            -- Limit completion menu height
vim.opt.smoothscroll = true       -- Smooth scrolling for wrapped lines
vim.opt.shortmess:append("WIcC")  -- Reduce message clutter
vim.opt.formatoptions:remove({ "c", "r", "o" }) -- Don't auto-continue comments

-- Folding (uncomment when treesitter is added)
-- vim.opt.foldmethod = "expr"
-- vim.opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"
-- vim.opt.foldlevelstart = 99

-- Load experimental options (uncomment to enable)
-- require("extras.options")

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
    local clients = vim.lsp.get_clients({ bufnr = 0 })
    if #clients > 0 then
      vim.lsp.buf.format({ async = false })
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
  "https://github.com/rebelot/kanagawa.nvim",
  "https://github.com/EdenEast/nightfox.nvim",
  "https://github.com/folke/snacks.nvim"
})

-- LSP
local lsp_servers = {
  lua_ls = {
    Lua = { workspace = { library = vim.api.nvim_get_runtime_file("lua", true) } },
  },
  vtsls = {},
  eslint = {},
  harper_ls = { -- Language spellcheck
    settings = {
      ["harper-ls"] = {
        linters = {
          SpellCheck = true,
        },
        isolateToEnglish = true,
      },
    },
  },
}
require("mason").setup()
require("mason-lspconfig").setup()
require("mason-tool-installer").setup({
  ensure_installed = vim.tbl_keys(lsp_servers),
})

for server, config in pairs(lsp_servers) do
  vim.lsp.config(server, {
    settings = config,
    on_attach = function(_, bufnr)
      vim.keymap.set("n", "gd", vim.lsp.buf.definition, { buffer = bufnr, desc = "Goto Definition" })
      vim.keymap.set("n", "gr", vim.lsp.buf.references, { buffer = bufnr, desc = "References" })
      vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, { buffer = bufnr, desc = "Code Action" })
      vim.keymap.set("n", "<leader>cr", vim.lsp.buf.rename, { buffer = bufnr, desc = "Rename" })
    end,
  })
end

-- Statusline
require("mini.statusline").setup()

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

-- Diagnostics
vim.diagnostic.config({ virtual_text = false })
require('tiny-inline-diagnostic').setup({
  preset = "ghost",
  options = {
    show_source = true,
    use_icons_from_diagnostic = true,
    add_extmark_to_line = true,
    virt_texts_linepos = 'right_align',
  }
})

-- Colorscheme
require('nightfox').setup({
  options = {
    compile_path = vim.fn.stdpath("cache") .. "/nightfox",
    compile_file_suffix = "_compiled", -- Compiled file suffix
    transparent = false                -- Disable setting background
  }
})

vim.cmd("colorscheme nightfox")

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
