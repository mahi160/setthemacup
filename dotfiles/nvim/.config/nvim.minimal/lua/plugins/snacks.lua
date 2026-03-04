local ok, snacks = pcall(require, "snacks")
if not ok then
  return
end

snacks.setup({ picker = { enabled = true, ui_select = true } })

local map = vim.keymap.set

map("n", "<leader><leader>", function()
  snacks.picker.smart()
end, { desc = "Smart Find" })
map("n", "<leader>ff", function()
  snacks.picker.files()
end, { desc = "Find Files" })
map("n", "<leader>fb", function()
  snacks.picker.buffers()
end, { desc = "Buffers" })
map("n", "<leader>/", function()
  snacks.picker.grep()
end, { desc = "Grep" })
map("n", "gd", function()
  snacks.picker.lsp_definitions()
end, { desc = "Goto Definition" })
map("n", "gr", function()
  snacks.picker.lsp_references()
end, { desc = "References" })
