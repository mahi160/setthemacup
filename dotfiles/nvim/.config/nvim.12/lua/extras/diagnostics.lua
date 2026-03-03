-- Diagnostic signs
local signs = {
  Error = "󰅚",
  Warn = "󰀪",
  Hint = "󰌶",
  Info = "",
}

for type, icon in pairs(signs) do
  local hl = "DiagnosticSign" .. type
  vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = hl })
end

-- Diagnostic configuration
vim.diagnostic.config({
  virtual_text = false,
  signs = true,
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
