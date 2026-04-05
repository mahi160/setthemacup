-- File Explorer (Oil.nvim) Configuration
-- Reference: :help oil

vim.pack.add({ "stevearc/oil.nvim" }, { confirm = false })

require("oil").setup({
	default_file_explorer = true,
	delete_to_trash = true,
	skip_confirm_for_simple_edits = true,
	view_options = {
		show_hidden = true,
	},
})
