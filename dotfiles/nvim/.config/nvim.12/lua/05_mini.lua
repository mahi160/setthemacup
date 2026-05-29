vim.pack.add({ "https://github.com/echasnovski/mini.nvim" })

require("mini.extra").setup()
require("mini.ai").setup({
	custom_textobjects = {
		f = require("mini.ai").gen_spec.treesitter({ a = "@function.outer", i = "@function.inner" }),
		c = require("mini.ai").gen_spec.treesitter({ a = "@class.outer", i = "@class.inner" }),
		o = require("mini.ai").gen_spec.treesitter({ a = "@conditional.outer", i = "@conditional.inner" }),
		l = require("mini.ai").gen_spec.treesitter({ a = "@loop.outer", i = "@loop.inner" }),
		a = require("mini.ai").gen_spec.treesitter({ a = "@parameter.outer", i = "@parameter.inner" }),
		b = require("mini.ai").gen_spec.treesitter({ a = "@block.outer", i = "@block.inner" }),
		C = require("mini.ai").gen_spec.treesitter({ a = "@comment.outer", i = "@comment.inner" }),
	},
})

require("mini.basics").setup({
	-- 01_core.lua owns all options — prevent mini.basics from overriding them
	-- (default basic=true sets backup=true, creating .ext-bak files everywhere)
	options = { basic = false, extra_ui = false, win_borders = "none" },
})
require("mini.cursorword").setup()
require("mini.cmdline").setup()
require("mini.diff").setup({ view = { style = "sign" } })
require("mini.git").setup()
require("mini.icons").setup()
require("mini.icons").mock_nvim_web_devicons()
require("mini.indentscope").setup()
require("mini.move").setup()

require("mini.notify").setup()
vim.notify = require("mini.notify").make_notify()

require("mini.pairs").setup()
require("mini.snippets").setup({ snippets = { require("mini.snippets").gen_loader.from_lang() } })
require("mini.splitjoin").setup()
require("mini.statusline").setup()
require("mini.surround").setup()
require("mini.tabline").setup()
require("mini.trailspace").setup()
require("mini.bufremove").setup()
require("mini.visits").setup()
