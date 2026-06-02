-- trouble.nvim: diagnostics panel, LSP references/definitions, quickfix list
-- <leader>xx / <leader>xl remain on quicker.nvim (quickfix / loclist)
-- trouble owns the <leader>x{d,D,r} namespace for diagnostics + references

vim.pack.add({ "https://github.com/folke/trouble.nvim" })

require("trouble").setup({
	modes = {
		diagnostics = { focus = true },
		lsp_references = { focus = true },
	},
})

local map = function(lhs, rhs, desc)
	vim.keymap.set("n", lhs, rhs, { silent = true, noremap = true, desc = desc })
end

map("<leader>xd", "<cmd>Trouble diagnostics toggle<CR>",          "Workspace diagnostics")
map("<leader>xD", "<cmd>Trouble diagnostics toggle filter.buf=0<CR>", "Buffer diagnostics")
map("<leader>xr", "<cmd>Trouble lsp_references toggle<CR>",        "LSP references")
