Pack("echasnovski/mini.nvim")

require("mini.tabline").setup({
  format = function(buf_id, label)
    local MiniTabline = require("mini.tabline")
    local formatted = MiniTabline.default_format(buf_id, label)

    if not vim.api.nvim_buf_is_loaded(buf_id) then
      return formatted
    end

    -- Count diagnostics
    local diagnostics = vim.diagnostic.get(buf_id)
    local error_count = 0
    local warn_count = 0

    for _, diag in ipairs(diagnostics) do
      if diag.severity == vim.diagnostic.severity.ERROR then
        error_count = error_count + 1
      elseif diag.severity == vim.diagnostic.severity.WARN then
        warn_count = warn_count + 1
      end
    end

    local indicator = ""

    if error_count > 0 then
      indicator = string.format("    ", error_count)
    elseif warn_count > 0 then
      indicator = string.format("    ", warn_count)
    end

    return formatted .. indicator
  end,
})

vim.api.nvim_create_autocmd("DiagnosticChanged", {
  group = vim.api.nvim_create_augroup("tabline_diagnostics", { clear = true }),
  desc = "Refresh tabline on diagnostic changes",
  callback = function()
    vim.cmd("redrawtabline")
  end,
})
