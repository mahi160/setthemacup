vim.pack.add({ "https://github.com/stevearc/oil.nvim.git" }, { confirm = false })
require("oil").setup({
  default_file_explorer = true,
  delete_to_trash = true,
  skip_confirm_for_simple_edits = true,
  view_options = {
    show_hidden = true,
  },
})

vim.keymap.set("n", "-", "<CMD>Oil<CR>", { desc = "[O]pen parent directory" })
