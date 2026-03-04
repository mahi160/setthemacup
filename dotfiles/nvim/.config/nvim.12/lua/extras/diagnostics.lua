vim.pack.add({ "https://github.com/rachartier/tiny-inline-diagnostic.nvim" })

local ok, tiny = pcall(require, "tiny-inline-diagnostic")
if ok then
  tiny.setup({
    preset = "ghost",
    options = {
      show_source = true,
      use_icons_from_diagnostic = false,
      add_extmark_to_line = true,
      virt_texts_linepos = "right_align",
    },
  })
end
