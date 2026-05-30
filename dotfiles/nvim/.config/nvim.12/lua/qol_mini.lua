-- ── mini.clue ─────────────────────────────────────────────────────────────────
local clue = require("mini.clue")
clue.setup({
	triggers = {
		{ mode = "n", keys = "<leader>" },
		{ mode = "x", keys = "<leader>" },
		{ mode = "n", keys = "g" },
		{ mode = "x", keys = "g" },
		{ mode = "n", keys = "z" },
		{ mode = "n", keys = "[" },
		{ mode = "n", keys = "]" },
		{ mode = "n", keys = '"' },
		{ mode = "n", keys = "'" },
		{ mode = "i", keys = "<C-x>" },
	},
	clues = {
		clue.gen_clues.builtin_completion(),
		clue.gen_clues.g(),
		clue.gen_clues.marks(),
		clue.gen_clues.registers(),
		clue.gen_clues.windows(),
		clue.gen_clues.z(),
		-- group hints (all in one place)
		{ mode = "n", keys = "gr",         desc = "+lsp" },
		{ mode = "n", keys = "gR",         desc = "+replace" },
		{ mode = "n", keys = "<leader>t", desc = "+toggle/tabs" },
		{ mode = "n", keys = "<leader>b", desc = "+buffer" },
		{ mode = "n", keys = "<leader>d", desc = "+database" },
		{ mode = "n", keys = "<leader>g", desc = "+git" },
		{ mode = "n", keys = "<leader>l", desc = "+live-preview" },
		{ mode = "n", keys = "<leader>q", desc = "+quit" },
		{ mode = "n", keys = "<leader>s", desc = "+search" },
		{ mode = "n", keys = "<leader>sw", desc = "substitute word" },
		{ mode = "n", keys = "<leader>tn", desc = "new tab" },
		{ mode = "n", keys = "<leader>tc", desc = "close tab" },
		{ mode = "n", keys = "<leader>to", desc = "only this tab" },
		{ mode = "n", keys = "<leader>x", desc = "+quickfix" },
		{ mode = "n", keys = "<leader>?", desc = "cheatsheet" },
	},
})

vim.ui.select = MiniPick.ui_select

-- ── mini.map ──────────────────────────────────────────────────────────────────
local minimap = require("mini.map")
minimap.setup({
	integrations = {
		minimap.gen_integration.builtin_search(),
		minimap.gen_integration.diagnostic(),
		minimap.gen_integration.diff(),
	},
})
vim.keymap.set("n", "<leader>tm", MiniMap.toggle, { silent = true, desc = "Toggle minimap" })

-- ── mini.git keymaps ──────────────────────────────────────────────────────────
vim.keymap.set({ "n", "x" }, "<leader>gh", function()
	MiniGit.show_at_cursor()
end, { desc = "Show git history" })
vim.keymap.set("n", "<leader>gb", "<cmd>vertical Git blame -- %<CR>", { desc = "Show git blame" })
vim.keymap.set("n", "<leader>gl", "<cmd>Git log --oneline -- %<CR>", { desc = "Show file git log" })
