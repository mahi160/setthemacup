Pack("echasnovski/mini.nvim")
require("mini.ai").setup()
require("mini.animate").setup()
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
