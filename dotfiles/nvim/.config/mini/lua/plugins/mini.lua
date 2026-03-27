return{
  'nvim-mini/mini.nvim', 
  version = '*',
  config = function()
    require("mini.ai").setup()
    require("mini.basics").setup()
    require("mini.clue").setup()
    require("mini.diff").setup()
    require("mini.indentscope").setup()
    require("mini.icons").setup()
    require("mini.move").setup()
    require("mini.pairs").setup()
    require("mini.statusline").setup()
    require("mini.surround").setup()
  end
}
