-- Neovim Configuration (0.12+)
-- Modern, modular, industry-standard setup

-- Load core configuration
require("config.options")
require("config.keymaps")
require("config.autocmds")

-- Bootstrap plugin manager (vim.pack)
require("config.plugins")
