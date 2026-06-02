vim.pack.add({
	"https://github.com/folke/flash.nvim",
	"https://github.com/wakatime/vim-wakatime",
	"https://github.com/brianhuster/live-preview.nvim",
	"https://github.com/folke/todo-comments.nvim",
	"https://github.com/MeanderingProgrammer/render-markdown.nvim",
	"https://github.com/windwp/nvim-ts-autotag",
	"https://github.com/vuki656/package-info.nvim",
})

require("flash").setup()

require("todo-comments").setup({})
require("render-markdown").setup({})

vim.keymap.set("n", "<leader>lo", "<cmd>LivePreview start<CR>", { silent = true, desc = "Open live preview" })
vim.keymap.set("n", "<leader>lc", "<cmd>LivePreview close<CR>", { silent = true, desc = "Close live preview" })

require("nvim-ts-autotag").setup()

-- ── package-info: inline npm version virtual text in package.json ─────────────
require("package-info").setup({ autostart = true, hide_up_to_date = true })
local map = function(lhs, rhs, desc)
	vim.keymap.set("n", lhs, rhs, { silent = true, noremap = true, desc = desc })
end
map("<leader>np", require("package-info").show, "Show package versions")
map("<leader>nu", require("package-info").update, "Update package on line")
map("<leader>nd", require("package-info").delete, "Delete package on line")
map("<leader>ni", require("package-info").install, "Install new package")
