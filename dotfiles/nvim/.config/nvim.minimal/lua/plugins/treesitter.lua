local ok, ts_configs = pcall(require, "nvim-treesitter.configs")
if not ok then
  return
end

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
