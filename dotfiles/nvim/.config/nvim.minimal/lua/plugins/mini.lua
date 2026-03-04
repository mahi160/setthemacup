require("mini.basics").setup({
  options = {
    basic = true,
    extra_ui = true,
    win_borders = "rounded",
  },
  mappings = {
    basic = true,
    option_toggle_prefix = "\\",
    windows = true,
    move_with_alt = false,
  },
  autocommands = {
    basic = true,
    relnum_in_visual_mode = false,
  },
})

require("mini.statusline").setup()

local ai_ok, ai = pcall(require, "mini.ai")
if ai_ok then
	local ts_spec = ai.gen_spec.treesitter
	ai.setup({
		custom_textobjects = {
			f = ts_spec({ a = "@function.outer", i = "@function.inner" }),
			c = ts_spec({ a = "@class.outer", i = "@class.inner" }),
			o = ts_spec({ a = { "@conditional.outer", "@loop.outer" }, i = { "@conditional.inner", "@loop.inner" } }),
			b = ts_spec({ a = "@block.outer", i = "@block.inner" }),
			k = ts_spec({ a = "@call.outer", i = "@call.inner" }),
			p = ts_spec({ a = "@parameter.outer", i = "@parameter.inner" }),
		},
	})
end

require("mini.diff").setup()
require("mini.indentscope").setup()
require("mini.move").setup()
require("mini.pairs").setup()
require("mini.surround").setup()
require("mini.trailspace").setup()
