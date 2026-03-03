vim.g.mapleader = " "
vim.g.maplocalleader = " "

vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.signcolumn = "yes"
vim.opt.cursorline = true
vim.opt.wrap = true
vim.opt.winborder = "rounded"
vim.opt.scrolloff = 12
vim.opt.showmode = false
vim.opt.timeoutlen = 300
vim.opt.updatetime = 250
vim.opt.ignorecase = true
vim.opt.smartcase = true
vim.opt.inccommand = "split"
vim.opt.clipboard = "unnamedplus"
vim.opt.breakindent = true
vim.opt.swapfile = false
vim.opt.autowrite = true
vim.opt.tabstop = 2
vim.opt.shiftwidth = 2
vim.opt.expandtab = true
vim.opt.textwidth = 120
vim.opt.pumheight = 10
vim.opt.shortmess:append("WIcC")
vim.opt.formatoptions:remove({ "c", "r", "o" })
vim.opt.spell = false
vim.opt.spelllang = "en_us"
vim.opt.spellfile = vim.fn.stdpath("config") .. "/spell/en.utf-8.add"
vim.opt.foldlevelstart = 99
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"

vim.keymap.set("n", "-", "<CMD>Oil<CR>", { desc = "Open parent directory" })
vim.keymap.set("n", "<Esc>", "<cmd>nohlsearch<CR>", { desc = "Clear search" })
vim.keymap.set("n", "[b", "<cmd>bprevious<CR>", { desc = "Previous buffer" })
vim.keymap.set("n", "]b", "<cmd>bnext<CR>", { desc = "Next buffer" })
vim.keymap.set("n", "[d", vim.diagnostic.goto_prev, { desc = "Previous diagnostic" })
vim.keymap.set("n", "]d", vim.diagnostic.goto_next, { desc = "Next diagnostic" })
vim.keymap.set("n", "<leader>cd", function()
  vim.diagnostic.enable(not vim.diagnostic.is_enabled())
end, { desc = "Toggle diagnostics" })
vim.keymap.set("n", "<D-s>", "<cmd>write<cr>", { desc = "Save" })
vim.keymap.set("i", "<D-s>", "<Esc><cmd>write<cr>", { desc = "Save" })
vim.keymap.set("v", "<D-s>", "<Esc><cmd>write<cr>", { desc = "Save" })

vim.pack.add({
  "https://github.com/nvim-mini/mini.nvim",
  "https://github.com/stevearc/oil.nvim",
  "https://github.com/neovim/nvim-lspconfig",
  "https://github.com/mason-org/mason.nvim",
  "https://github.com/mason-org/mason-lspconfig.nvim",
  "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim",
  "https://github.com/folke/snacks.nvim",
  "https://github.com/nvim-treesitter/nvim-treesitter",
  "https://github.com/L3MON4D3/LuaSnip",
  "https://github.com/rafamadriz/friendly-snippets",
  "https://github.com/saghen/blink.cmp",
})

local ts_ok, ts_configs = pcall(require, "nvim-treesitter.configs")
if ts_ok then
  ts_configs.setup({
    ensure_installed = { "lua", "vim", "vimdoc", "query" },
    auto_install = true,
    highlight = { enable = true },
    indent = { enable = true },
    incremental_selection = {
      enable = true,
      keymaps = {
        init_selection = "<CR>",
        scope_incremental = "<CR>",
        node_decremental = "<BS>",
      },
    },
  })
end

require("mason").setup()
require("mason-lspconfig").setup({ automatic_installation = true })

local servers = { "lua_ls", "vtsls" }

local lsp_keymaps = {
  { "n", "K", vim.lsp.buf.hover, { desc = "Hover" } },
  { "n", "<leader>ca", vim.lsp.buf.code_action, { desc = "Code Action" } },
  { "n", "<leader>cr", vim.lsp.buf.rename, { desc = "Rename" } },
}

local function setup_lsp_keymaps(bufnr)
  for _, map in ipairs(lsp_keymaps) do
    local mode, lhs, rhs, opts = map[1], map[2], map[3], map[4]
    opts.buffer = bufnr
    vim.keymap.set(mode, lhs, rhs, opts)
  end
end

local capabilities = vim.lsp.protocol.make_client_capabilities()
capabilities.textDocument.completion.completionItem.snippetSupport = true

local blink_ok, blink = pcall(require, "blink.cmp")
if blink_ok then
  capabilities = blink.get_lsp_capabilities(capabilities)
end

require("mason-tool-installer").setup({ ensure_installed = servers })

for _, server in ipairs(servers) do
  vim.lsp.config(server, {
    capabilities = capabilities,
    on_attach = function(_, bufnr)
      setup_lsp_keymaps(bufnr)
    end,
  })
end

vim.diagnostic.config({
  virtual_text = false,
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = "󰅚",
      [vim.diagnostic.severity.WARN] = "󰀪",
      [vim.diagnostic.severity.HINT] = "󰌶",
      [vim.diagnostic.severity.INFO] = "",
    },
  },
  underline = true,
  update_in_insert = false,
  severity_sort = true,
  float = {
    border = "rounded",
    source = true,
    header = "",
    prefix = "",
  },
})

if blink_ok then
  blink.setup({
    keymap = { preset = "default" },
    sources = {
      default = { "lsp", "path", "snippets", "buffer" },
      providers = {
        snippets = {
          opts = {
            friendly_snippets = true,
            search_paths = { vim.fn.stdpath("config") .. "/snippets" },
          },
        },
      },
    },
    snippets = { preset = "luasnip" },
    completion = {
      accept = { auto_brackets = { enabled = true } },
      menu = { border = "rounded", scrollbar = true, max_height = 10 },
      documentation = {
        auto_show = true,
        auto_show_delay_ms = 200,
        window = { border = "rounded" },
      },
    },
    signature = { enabled = true, window = { border = "rounded" } },
  })
end

require("mini.statusline").setup()

local ai_ok, ai = pcall(require, "mini.ai")
if ai_ok then
  local ts_spec = ai.gen_spec.treesitter
  ai.setup({
    custom_textobjects = {
      f = ts_spec({ a = "@function.outer", i = "@function.inner" }),
      c = ts_spec({ a = "@class.outer", i = "@class.inner" }),
      o = ts_spec({ a = { "@conditional.outer", "@loop.outer" }, i = { "@conditional.inner", "@loop.inner" } }),
      b = ts_spec({ a = "@block.outer", i = "@block.inner" }),
      k = ts_spec({ a = "@call.outer", i = "@call.inner" }),
      p = ts_spec({ a = "@parameter.outer", i = "@parameter.inner" }),
    },
  })
end

require("mini.animate").setup()
require("mini.diff").setup()

require("oil").setup({
  default_file_explorer = true,
  delete_to_trash = true,
  skip_confirm_for_simple_edits = true,
  view_options = { show_hidden = true },
})

local snacks_ok, snacks = pcall(require, "snacks")
if snacks_ok then
  snacks.setup({ picker = { enabled = true, ui_select = true } })
  vim.keymap.set("n", "<leader><leader>", function() snacks.picker.smart() end, { desc = "Smart Find" })
  vim.keymap.set("n", "<leader>ff", function() snacks.picker.files() end, { desc = "Find Files" })
  vim.keymap.set("n", "<leader>fb", function() snacks.picker.buffers() end, { desc = "Buffers" })
  vim.keymap.set("n", "<leader>/", function() snacks.picker.grep() end, { desc = "Grep" })
  vim.keymap.set("n", "gd", function() snacks.picker.lsp_definitions() end, { desc = "Goto Definition" })
  vim.keymap.set("n", "gr", function() snacks.picker.lsp_references() end, { desc = "References" })
end

pcall(require, "extras.conform")
pcall(require, "extras.ai")
pcall(require, "extras.colorscheme")
pcall(require, "extras.picker")
pcall(require, "extras.completion")
pcall(require, "extras.lsp")
pcall(require, "extras.diagnostics")
pcall(require, "extras.options")
pcall(require, "extras.better-escape")
