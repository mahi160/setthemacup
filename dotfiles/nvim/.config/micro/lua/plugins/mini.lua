-- Mini.nvim Configuration
-- Collection of minimal, independent plugins
-- Reference: :help mini

vim.pack.add({ "nvim-mini/mini.nvim" }, { confirm = false })

require("mini.basics").setup()
require("mini.icons").setup()
require("mini.statusline").setup()
require("mini.ai").setup()
require("mini.move").setup()
require("mini.clue").setup()
require("mini.diff").setup()
require("mini.indentscope").setup()
require("mini.completion").setup()
require("mini.notify").setup()
require("mini.pairs").setup()
require("mini.snippets").setup()
require("mini.surround").setup()
