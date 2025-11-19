-- UI diagnostics, quickfix, and visual feedback
vim.pack.add({
	"https://github.com/rachartier/tiny-inline-diagnostic.nvim", -- inline diagnostic display
	"https://github.com/folke/todo-comments.nvim", -- highlight TODO, FIXME comments
	"https://github.com/stevearc/quicker.nvim", -- enhanced quickfix list
}, { confirm = false })

-- inline diagnostics: ghost-style error display
require("tiny-inline-diagnostic").setup({
	preset = "ghost",
})
vim.diagnostic.config({ virtual_text = false })

-- todo comments: syntax highlighting for comments
require("todo-comments").setup()

-- quicker: improved quickfix experience
require("quicker").setup()
vim.keymap.set("n", "<leader>q", function()
	require("quicker").toggle()
end, {
	desc = "Toggle quickfix",
})
vim.keymap.set("n", "<leader>l", function()
	require("quicker").toggle({ loclist = true })
end, {
	desc = "Toggle loclist",
})