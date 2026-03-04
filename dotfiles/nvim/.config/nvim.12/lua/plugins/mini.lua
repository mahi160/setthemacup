Pack("echasnovski/mini.nvim")

require("mini.ai").setup({
	custom_textobjects = {
		-- Treesitter textobjects integration
		f = require("mini.ai").gen_spec.treesitter({ a = "@function.outer", i = "@function.inner" }),
		c = require("mini.ai").gen_spec.treesitter({ a = "@class.outer", i = "@class.inner" }),
		o = require("mini.ai").gen_spec.treesitter({ a = "@conditional.outer", i = "@conditional.inner" }),
		l = require("mini.ai").gen_spec.treesitter({ a = "@loop.outer", i = "@loop.inner" }),
		a = require("mini.ai").gen_spec.treesitter({ a = "@parameter.outer", i = "@parameter.inner" }),
		b = require("mini.ai").gen_spec.treesitter({ a = "@block.outer", i = "@block.inner" }),
		C = require("mini.ai").gen_spec.treesitter({ a = "@comment.outer", i = "@comment.inner" }),
	},
})
require("mini.animate").setup({
	scroll = {
		enable = false, -- Disable scroll animation to prevent stuttering with mouse/trackpad
	},
})
require("mini.basics").setup()
require("mini.cursorword").setup()
require("mini.indentscope").setup()
require("mini.move").setup()
require("mini.pairs").setup()
require("mini.statusline").setup()
require("mini.tabline").setup()
require("mini.trailspace").setup()
require("mini.diff").setup({ view = {
	style = "sign",
} })
require("mini.icons").mock_nvim_web_devicons()
require("mini.starter").setup({
	autoopen = true,
})
