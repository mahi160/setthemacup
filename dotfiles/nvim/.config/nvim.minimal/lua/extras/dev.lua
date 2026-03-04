vim.pack.add({ "https://github.com/folke/lazydev.nvim" })

local ok, lazydev = pcall(require, "lazydev")
if ok then
  lazydev.setup({
    library = {
      { path = "${3rd}/luv/library", words = { "vim%.uv" } },
    },
  })
end
