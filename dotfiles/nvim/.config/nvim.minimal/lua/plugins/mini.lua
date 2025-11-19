vim.pack.add({ "https://github.com/echasnovski/mini.nvim" }, { confirm = false })

require("mini.ai").setup() -- better text objects (va" vi" etc)
require("mini.animate").setup() -- smooth scrolling animations
require("mini.basics").setup() -- sensible defaults
require("mini.cursorword").setup() -- highlight word under cursor
require("mini.indentscope").setup() -- show indent scope guides
require("mini.icons").setup() -- file/folder icons
require("mini.move").setup() -- move lines/blocks with alt+hjkl
require("mini.pairs").setup() -- auto-close brackets/quotes
require("mini.surround").setup() -- manipulate surroundings (sa/sd/sr)
require("mini.statusline").setup() -- clean statusline
require("mini.tabline").setup() -- buffer tabs
require("mini.trailspace").setup() -- highlight trailing whitespace
require("mini.diff").setup({ -- git diff in sign column
	view = {
		style = "sign",
	},
})

require("mini.icons").mock_nvim_web_devicons()
