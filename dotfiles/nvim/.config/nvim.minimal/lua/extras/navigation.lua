vim.pack.add({ "https://github.com/folke/flash.nvim" })

local ok, flash = pcall(require, "flash")
if not ok then
  return
end

flash.setup({
  modes = {
    char = {
      enabled = true,
      keys = { "f", "F", "t", "T" },
    },
  },
})

vim.keymap.set({ "n", "x", "o" }, "<leader>j", function()
  flash.jump()
end, { desc = "Flash Jump" })

vim.keymap.set({ "n", "x", "o" }, "<leader>t", function()
  flash.treesitter()
end, { desc = "Flash Treesitter" })
