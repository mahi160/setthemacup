vim.pack.add{"https://github.com/nvim-treesitter/nvim-treesitter"}

require("nvim-treesitter").setup({
  sync_install = true,
  modules = {},
  ignore_install = {},
  ensure_installed = {
    -- Web tech
    "javascript",
    "typescript",
    "tsx",
    "jsx",
    "html",
    "css",
    "scss",
    "json",
    "yaml",
    "toml",
    "markdown",
    "markdown_inline",
    -- Go
    "go",
    "gomod",
    "gosum",
    "gowork",
    -- Lua & config
    "lua",
    "vim",
    "vimdoc",
    -- Utilities
    "bash",
    "regex",
  },
  auto_install = true,
  highlight = {
    enable = true,
  },
  indent = { enable = true },
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
