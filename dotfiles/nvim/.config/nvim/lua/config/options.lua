vim.o.colorcolumn = "120"
vim.o.textwidth = 120
vim.o.swapfile = false

-- inline colour swatch next to hex/rgb values (■ block before the value)
vim.lsp.document_color.enable(true, nil, { style = "virtual" })
