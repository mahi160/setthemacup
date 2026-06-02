vim.pack.add({
	"https://github.com/nvim-treesitter/nvim-treesitter",
})

local parsers = {
	"bash",
	"css",
	"dockerfile",
	"go",
	"html",
	"javascript",
	"jsdoc",
	"json",
	"lua",
	"markdown",
	"markdown_inline",
	"python",
	"regex",
	"sql",
	"svelte",
	"toml",
	"tsx",
	"typescript",
	"vim",
	"yaml",
}

-- Ensure all parsers are installed (synchronous install if missing)
local ts = require("nvim-treesitter")
for _, parser in ipairs(parsers) do
	if vim.fn.executable("tree-sitter") == 1 then
		pcall(function()
			ts.install({ parser })
		end)
	end
end

vim.api.nvim_create_autocmd("FileType", {
	group = vim.api.nvim_create_augroup("ts_highlight", { clear = true }),
	pattern = parsers,
	callback = function()
		pcall(vim.treesitter.start)
	end,
})
