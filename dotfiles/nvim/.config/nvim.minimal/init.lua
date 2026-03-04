vim.g.mapleader = " "
vim.g.maplocalleader = " "

function Pack(plugins, opts)
  opts = opts or { confirm = false }
  local plugin_list = type(plugins) == "table" and plugins or { plugins }
  local processed_plugins = {}
  for _, plugin in ipairs(plugin_list) do
    if not plugin:match("^https?://") and not plugin:match("^git@") then
      if plugin:match("^[%w%-_%.]+/[%w%-_%.]+$") then
        plugin = "https://github.com/" .. plugin
      end
    end
    table.insert(processed_plugins, plugin)
  end
  return vim.pack.add(processed_plugins, opts)
end

require("config.options")
require("config.keymaps")
require("config.autocmds")

Pack({
  "nvim-mini/mini.nvim",
  "stevearc/oil.nvim",
  "neovim/nvim-lspconfig",
  "mason-org/mason.nvim",
  "mason-org/mason-lspconfig.nvim",
  "WhoIsSethDaniel/mason-tool-installer.nvim",
  "folke/snacks.nvim",
  "nvim-treesitter/nvim-treesitter",
  "L3MON4D3/LuaSnip",
  "rafamadriz/friendly-snippets",
  "saghen/blink.cmp",
})

require("plugins.treesitter")
require("plugins.lsp")
require("plugins.blink")
require("plugins.mini")
require("plugins.oil")
require("plugins.snacks")

pcall(require, "extras.ai")
pcall(require, "extras.colorscheme")
pcall(require, "extras.conform")
pcall(require, "extras.dev")
pcall(require, "extras.diagnostics")
pcall(require, "extras.lsp-extended")
pcall(require, "extras.misc")
pcall(require, "extras.navigation")
pcall(require, "extras.picker")
pcall(require, "extras.tools")
pcall(require, "extras.ui")
