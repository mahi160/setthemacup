local map = vim.keymap.set
local function o(desc)
	return { silent = true, noremap = true, desc = desc }
end

local cheatsheet = vim.fn.stdpath("config") .. "/CHEATSHEET.md"

map("n", "<leader>?", function()
	vim.cmd("edit " .. cheatsheet)
end, o("Open cheatsheet"))

map("i", "jj", "<Esc>", { silent = true, desc = "Exit insert" })

map("n", "<Esc>", "<cmd>nohlsearch<CR>", o("Clear search highlight"))
map("n", "<leader>qq", "<cmd>qa<CR>", o("Quit all"))

map("n", "<C-h>", "<C-w>h", o("Focus left"))
map("n", "<C-j>", "<C-w>j", o("Focus down"))
map("n", "<C-k>", "<C-w>k", o("Focus up"))
map("n", "<C-l>", "<C-w>l", o("Focus right"))

map({ "n", "v" }, "<leader>y", '"+y', o("Yank to clipboard"))
map({ "n", "v" }, "<leader>p", '"+p', o("Paste from clipboard"))
map({ "n", "v" }, "<leader>P", '"+P', o("Paste from clipboard (before)"))

map("n", "<leader>tu", "<cmd>UndotreeToggle<CR>", o("Toggle undotree"))

map("n", "<leader>|", "<cmd>vsplit<CR>", o("Split vertically"))
map("n", "<leader>-", "<cmd>split<CR>", o("Split horizontally"))

map("n", "<S-h>", "<cmd>bprevious<CR>", o("Prev buffer"))
map("n", "<S-l>", "<cmd>bnext<CR>", o("Next buffer"))
map("n", "<S-j>", "<cmd>b#<CR>", o("Last buffer"))

map("n", "<C-d>", "<C-d>zz", o("Scroll down centered"))
map("n", "<C-u>", "<C-u>zz", o("Scroll up centered"))
map("n", "n", "nzzzv", o("Next match centered"))
map("n", "N", "Nzzzv", o("Prev match centered"))

map("n", "<leader>bd", function()
	MiniBufremove.delete()
end, o("Delete buffer"))

map("n", "<leader>bo", function()
	local cur = vim.fn.bufnr()
	for _, buf in ipairs(vim.fn.getbufinfo({ buflisted = 1 })) do
		if buf.bufnr ~= cur then
			vim.api.nvim_buf_delete(buf.bufnr, { force = false })
		end
	end
end, o("Close other buffers"))

-- ── Edit helpers ──────────────────────────────────────────────────────────────
map("x", "p", '"_dP', o("Paste over selection without clobbering register"))
map({ "n", "v" }, "<leader>d", '"_d', o("Delete without yanking"))
map("n", "J", "mzJ`z", o("Join lines without moving cursor"))
map("v", "<", "<gv", o("Unindent and keep selection"))
map("v", ">", ">gv", o("Indent and keep selection"))

-- ── Utility ───────────────────────────────────────────────────────────────────
map("n", "<leader>X", "<cmd>!chmod +x %<CR>", { silent = true, desc = "Make file executable" })
map("n", "<leader>re", "<cmd>restart<CR>", o("Restart config"))

-- ── Find & replace ────────────────────────────────────────────────────────────
map("n", "<leader>sw", [[:%s/\<<C-r><C-w>\>/<C-r><C-w>/gI<Left><Left><Left>]], o("Substitute word under cursor"))

-- ── Tabs ──────────────────────────────────────────────────────────────────────
map("n", "gt", "gt", o("Next tab"))
map("n", "gT", "gT", o("Previous tab"))
map("n", "<leader>tn", "<cmd>tabnew<CR>", o("New tab"))
map("n", "<leader>tc", "<cmd>tabclose<CR>", o("Close tab"))
map("n", "<leader>to", "<cmd>tabonly<CR>", o("Close other tabs"))
