vim.pack.add({ "https://github.com/max397574/better-escape.nvim" })

local ok, better_escape = pcall(require, "better-escape")
if ok then
  better_escape.setup()
end
