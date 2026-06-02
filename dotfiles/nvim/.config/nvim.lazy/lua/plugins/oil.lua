return {
  {
    "stevearc/oil.nvim",
    lazy = false, -- must load at startup to intercept `nvim .` directory opens
    config = function()
      require("oil").setup({
        default_file_explorer = true,
        delete_to_trash = true,
        skip_confirm_for_simple_edits = true,
        view_options = {
          show_hidden = true,
        },
      })
    end,
  },
}
