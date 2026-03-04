vim.pack.add({
  "https://github.com/sphamba/smear-cursor.nvim",
  "https://github.com/folke/todo-comments.nvim",
})

local smear_ok, smear = pcall(require, "smear_cursor")
if smear_ok then
  smear.setup()
end

local todo_ok, todo = pcall(require, "todo-comments")
if todo_ok then
  todo.setup()
end
