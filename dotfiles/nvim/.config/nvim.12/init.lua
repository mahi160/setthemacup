require('vim._core.ui2').enable({})
-- =========================
-- BASICS
-- =========================
vim.g.mapleader = " "

vim.o.number = true
vim.o.relativenumber = true
vim.o.signcolumn = "yes"
vim.o.ignorecase = true
vim.o.smartcase = true
vim.o.colorcolumn = "120"
vim.o.textwidth = 120
vim.o.wrap = true
vim.o.swapfile = false
vim.o.confirm = true
vim.o.linebreak = true
vim.o.termguicolors = true
vim.o.tabstop = 2
vim.o.shiftwidth = 2
vim.o.expandtab = true

-- =========================
-- PLUGINS
-- =========================
vim.cmd.packadd("nvim.undotree")

vim.pack.add({
  "https://github.com/nvim-mini/mini.nvim",
  "https://github.com/stevearc/oil.nvim",
  "https://github.com/sainnhe/gruvbox-material",

  -- LSP
  "https://github.com/neovim/nvim-lspconfig",
  "https://github.com/mason-org/mason.nvim",
  "https://github.com/mason-org/mason-lspconfig.nvim",

  -- Completion
  "https://github.com/hrsh7th/nvim-cmp",
  "https://github.com/hrsh7th/cmp-nvim-lsp",
  "https://github.com/L3MON4D3/LuaSnip",
  "https://github.com/saadparwaiz1/cmp_luasnip",

  -- Formatting
  "https://github.com/stevearc/conform.nvim",

  -- UI
  "https://github.com/rachartier/tiny-inline-diagnostic.nvim",

  -- Misc
  "https://github.com/max397574/better-escape.nvim",
})

-- =========================
-- COLORS
-- =========================
vim.g.gruvbox_material_transparent_background = 2
vim.cmd.colorscheme("gruvbox-material")

-- =========================
-- MINI
-- =========================
require("mini.ai").setup()
require("mini.move").setup()
require("mini.pairs").setup()
require("mini.icons").setup()
require("mini.statusline").setup()
require("mini.pick").setup()

vim.keymap.set("n", "<leader><leader>", MiniPick.builtin.files)
vim.keymap.set("n", "<leader>/", MiniPick.builtin.grep_live)
vim.keymap.set("n", "<leader>b", MiniPick.builtin.buffers)

-- =========================
-- OIL
-- =========================
require("oil").setup({
  default_file_explorer = true,
  view_options = { show_hidden = true },
})
vim.keymap.set("n", "-", "<CMD>Oil<CR>")

-- =========================
-- DIAGNOSTICS UI
-- =========================
require("tiny-inline-diagnostic").setup()

vim.diagnostic.config({
  virtual_text = false,
  signs = true,
  underline = true,
  update_in_insert = false,
})

-- =========================
-- COMPLETION
-- =========================
local cmp = require("cmp")
local luasnip = require("luasnip")

cmp.setup({
  snippet = {
    expand = function(args)
      luasnip.lsp_expand(args.body)
    end,
  },

  mapping = cmp.mapping.preset.insert({
    ["<C-n>"] = cmp.mapping.select_next_item(),
    ["<C-p>"] = cmp.mapping.select_prev_item(),
    ["<C-y>"] = cmp.mapping.confirm({ select = true }),
    ["<C-Space>"] = cmp.mapping.complete(),

    ["<Tab>"] = cmp.mapping(function(fallback)
      if cmp.visible() then
        cmp.select_next_item()
      elseif luasnip.expand_or_jumpable() then
        luasnip.expand_or_jump()
      else
        fallback()
      end
    end, { "i", "s" }),

    ["<S-Tab>"] = cmp.mapping(function(fallback)
      if cmp.visible() then
        cmp.select_prev_item()
      elseif luasnip.jumpable(-1) then
        luasnip.jump(-1)
      else
        fallback()
      end
    end, { "i", "s" }),
  }),

  sources = {
    { name = "nvim_lsp" },
    { name = "luasnip" },
  },
})

-- =========================
-- LSP
-- =========================
require("mason").setup()

require("mason-lspconfig").setup({
  ensure_installed = {
    "lua_ls",
    "ts_ls",
    "pyright",
    "bashls",
    "jsonls",
  },
})

local lspconfig = require("lspconfig")
local capabilities = require("cmp_nvim_lsp").default_capabilities()

vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local opts = { buffer = args.buf }

    vim.keymap.set("n", "gd", vim.lsp.buf.definition, opts)
    vim.keymap.set("n", "gr", vim.lsp.buf.references, opts)
    vim.keymap.set("n", "K", vim.lsp.buf.hover, opts)

    vim.keymap.set("n", "<leader>rn", vim.lsp.buf.rename, opts)
    vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, opts)

    vim.keymap.set("n", "[d", vim.diagnostic.goto_prev, opts)
    vim.keymap.set("n", "]d", vim.diagnostic.goto_next, opts)
  end,
})

require("mason-lspconfig").setup_handlers({
  function(server)
    lspconfig[server].setup({
      capabilities = capabilities,
    })
  end,

  ["lua_ls"] = function()
    lspconfig.lua_ls.setup({
      capabilities = capabilities,
      settings = {
        Lua = {
          diagnostics = { globals = { "vim" } },
        },
      },
    })
  end,
})

-- =========================
-- FORMATTING
-- =========================
require("conform").setup({
  format_on_save = {
    timeout_ms = 500,
    lsp_fallback = true,
  },

  formatters_by_ft = {
    lua = { "stylua" },
    javascript = { "prettier" },
    typescript = { "prettier" },
    python = { "black" },
    json = { "prettier" },
    sh = { "shfmt" },
  },
})

vim.keymap.set("n", "<leader>f", function()
  require("conform").format({ async = true })
end)

-- =========================
-- MISC
-- =========================
require("better_escape").setup()

vim.filetype.add({
  extension = {
    svelte = "svelte",
    mdx = "mdx",
  },
})
