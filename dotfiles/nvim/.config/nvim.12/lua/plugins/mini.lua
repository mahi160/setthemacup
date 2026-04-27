vim.pack.add{"https://github.com/echasnovski/mini.nvim"}

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

require("mini.basics").setup()
require("mini.cursorword").setup()
require("mini.indentscope").setup()
require("mini.move").setup()
require("mini.pairs").setup()

require("mini.surround").setup({
  mappings = {
    add = "gsa",            -- Add surrounding in Normal and Visual modes
    delete = "gsd",         -- Delete surrounding
    find = "gsf",           -- Find surrounding (to the right)
    find_left = "gsF",      -- Find surrounding (to the left)
    highlight = "gsh",      -- Highlight surrounding
    replace = "gsr",        -- Replace surrounding
    update_n_lines = "gsn", -- Update `n_lines`
  },
})
require("mini.statusline").setup()
require("mini.trailspace").setup()
require("mini.diff").setup({
  view = {
    style = "sign",
  }
})
require("mini.icons").mock_nvim_web_devicons()
