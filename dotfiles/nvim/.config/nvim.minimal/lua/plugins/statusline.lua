-- INFO: better statusline
vim.pack.add({ "https://github.com/nvim-lualine/lualine.nvim" }, { confirm = false })

require("lualine").setup({
  options = {
    section_separators = { left = "", right = "" },
    component_separators = { left = "", right = "" },
  },
  sections = {
    lualine_a = { 'mode' },
    lualine_b = { { 'branch', icon = '' } },
    lualine_c = { { 'filename', path = 1, symbols = { modified = '[+]', readonly = '' } } },
    lualine_x = { { 'diagnostics', sources = { 'nvim_diagnostic' }, symbols = { error = ' ', warn = ' ', info = ' ', hint = ' ' } }, 'filetype' },
    lualine_y = { 'progress' },
    lualine_z = { 'location' },
  },
})
