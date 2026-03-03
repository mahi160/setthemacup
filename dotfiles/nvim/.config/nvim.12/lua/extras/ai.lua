local copilot_ok, copilot = pcall(require, "copilot")
if not copilot_ok then return end

copilot.setup({
  suggestion = { enabled = false }, -- Disable inline suggestions
  panel = { enabled = false },      -- Disable panel (using blink instead)
  filetypes = {
    yaml = false,
    markdown = true, -- Enable for markdown
    help = false,
    gitcommit = false,
    gitrebase = false,
    ["."] = false,
  },
})

-- Add copilot source to blink.cmp
local blink_ok, blink = pcall(require, "blink.cmp")
if not blink_ok then return end

blink.setup({
  sources = {
    default = { "lsp", "path", "snippets", "buffer", "copilot" },
    providers = {
      copilot = {
        name = "copilot",
        module = "blink-cmp-copilot",
        score_offset = 100, -- Prioritize AI suggestions
        async = true,
        transform_items = function(_, items)
          local CompletionItemKind = require("blink.cmp.types").CompletionItemKind
          local kind_idx = #CompletionItemKind + 1
          CompletionItemKind[kind_idx] = "Copilot"
          for _, item in ipairs(items) do
            item.kind = kind_idx
          end
          return items
        end,
      },
    },
  },
})
