-- Diagnostic configuration
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

-- Tiny inline diagnostic
require('tiny-inline-diagnostic').setup({
  preset = "ghost",
  options = {
    show_source = true,
    use_icons_from_diagnostic = false,
    add_extmark_to_line = true,
    virt_texts_linepos = 'right_align',
  }
})
