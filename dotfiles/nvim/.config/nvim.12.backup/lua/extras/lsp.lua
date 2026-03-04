local extended_servers = {
  gopls = {
    settings = {
      gopls = {
        analyses = { unusedparams = true, shadow = true },
        staticcheck = true,
        gofumpt = true,
      },
    },
  },
  eslint = {
    settings = {
      workingDirectories = { mode = "auto" },
      format = true,
    },
  },
  html = {},
  tailwindcss = {},
  jsonls = {},
  yamlls = {},
  harper_ls = {
    settings = {
      ["harper-ls"] = {
        linters = { SpellCheck = true },
        isolateToEnglish = true,
      },
    },
  },
}

local inlay_hints_keymaps = {
  { "n", "<leader>ih", function()
    vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
  end, { desc = "Toggle Inlay Hints" } },
}

local function setup_inlay_keymaps(bufnr)
  for _, map in ipairs(inlay_hints_keymaps) do
    local mode, lhs, rhs, opts = map[1], map[2], map[3], map[4]
    opts.buffer = bufnr
    vim.keymap.set(mode, lhs, rhs, opts)
  end
end

local capabilities = vim.lsp.protocol.make_client_capabilities()
capabilities.textDocument.completion.completionItem.snippetSupport = true

local blink_ok, blink = pcall(require, "blink.cmp")
if blink_ok then
  capabilities = blink.get_lsp_capabilities(capabilities)
end

local mason_installer_ok = pcall(require, "mason-tool-installer")
if mason_installer_ok then
  require("mason-tool-installer").setup({
    ensure_installed = vim.tbl_keys(extended_servers)
  })
end

for server, config in pairs(extended_servers) do
  vim.lsp.config(server, {
    settings = config.settings,
    capabilities = capabilities,
    on_attach = function(_, bufnr)
      setup_inlay_keymaps(bufnr)
    end,
  })
end
