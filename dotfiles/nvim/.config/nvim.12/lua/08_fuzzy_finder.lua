require("mini.pick").setup({
	window = {
		prompt_prefix = "   ",
		prompt_caret = "│",
	},
	options = {
		use_cache = true,
	},
	source = {
		show = function(buf_id, items, query)
			MiniPick.default_show(buf_id, items, query, { show_icons = true })
		end,
	},
})

-- ── Transparent highlights, inheriting fg from the active theme ────────────────
local function pick_hl()
	local function fg(group)
		local ok, hl = pcall(vim.api.nvim_get_hl, 0, { name = group, link = false })
		return (ok and hl.fg) and hl.fg or nil
	end
	local set = function(group, opts)
		vim.api.nvim_set_hl(0, group, opts)
	end
	set("MiniPickNormal", { fg = fg("NormalFloat"), bg = "NONE" })
	set("MiniPickBorder", { fg = fg("FloatBorder"), bg = "NONE" })
	set("MiniPickBorderBusy", { fg = fg("DiagnosticFloatingWarn"), bg = "NONE" })
	set("MiniPickBorderText", { fg = fg("FloatTitle"), bg = "NONE" })
	set("MiniPickHeader", { fg = fg("DiagnosticFloatingHint"), bg = "NONE" })
	set("MiniPickPrompt", { fg = fg("DiagnosticFloatingInfo"), bg = "NONE" })
	set("MiniPickPromptCaret", { fg = fg("DiagnosticFloatingInfo"), bg = "NONE" })
	set("MiniPickPromptPrefix", { fg = fg("DiagnosticFloatingInfo"), bg = "NONE" })
end

vim.api.nvim_create_autocmd("ColorScheme", {
	group = vim.api.nvim_create_augroup("MiniPickTheme", { clear = true }),
	callback = pick_hl,
})
pick_hl()

-- ── Files picker: mini.visits frecency on top, then all project files ────────
local function pick_files(opts)
	opts = opts or {}
	local cwd = (opts.source and opts.source.cwd) or vim.uv.cwd()

	-- 1. Get visited paths ranked by mini.visits (recency × frequency)
	local ok, visits = pcall(require, "mini.visits")
	local visited_abs = (ok and visits ~= nil) and visits.list_paths(cwd) or {}

	-- Normalize absolute → relative paths for display + dedup key (prune deleted files)
	local seen = {}
	local items = {}
	for _, abs in ipairs(visited_abs) do
		if vim.fn.filereadable(abs) == 1 then -- skip deleted/inaccessible files
			local rel = vim.fn.fnamemodify(abs, ":~:.")
			if not seen[rel] then
				seen[rel] = true
				table.insert(items, rel)
			end
		end
	end

	-- 2. Collect all project files via fd / rg / fallback
	local all_files = {}
	if vim.fn.executable("fd") == 1 then
		local out = vim.fn.systemlist(
			"fd --type=f --hidden --exclude=.git --color=never . " .. vim.fn.shellescape(cwd)
		)
		if vim.v.shell_error ~= 0 then
			vim.notify("fd error (code " .. vim.v.shell_error .. "): falling back", vim.log.levels.WARN)
			return MiniPick.builtin.files(nil, opts)
		end
		for _, line in ipairs(out) do
			if line ~= "" then
				table.insert(all_files, vim.fn.fnamemodify(line, ":~:."))
			end
		end
	elseif vim.fn.executable("rg") == 1 then
		local out = vim.fn.systemlist(
			"rg --files --hidden --glob=!.git --color=never " .. vim.fn.shellescape(cwd)
		)
		if vim.v.shell_error ~= 0 then
			vim.notify("rg error (code " .. vim.v.shell_error .. "): falling back", vim.log.levels.WARN)
			return MiniPick.builtin.files(nil, opts)
		end
		for _, line in ipairs(out) do
			if line ~= "" then
				table.insert(all_files, vim.fn.fnamemodify(line, ":~:."))
			end
		end
	else
		-- fallback: let mini.pick scan itself (no frecency reorder in this path)
		return MiniPick.builtin.files(nil, opts)
	end

	-- 3. Append non-visited files (preserve fd/rg order for the tail)
	for _, rel in ipairs(all_files) do
		if not seen[rel] then
			seen[rel] = true
			table.insert(items, rel)
		end
	end

	-- 4. Open picker with the merged, frecency-first list
	local source = vim.tbl_deep_extend("force", opts.source or {}, {
		items = items,
		cwd = cwd,
		name = "Files (frecency)",
		show = function(buf_id, show_items, query)
			MiniPick.default_show(buf_id, show_items, query, { show_icons = true })
		 end,
		choose = function(item)
			vim.schedule(function()
				vim.cmd("edit " .. vim.fn.fnameescape(item))
			end)
		end,
	})
	return MiniPick.start({ source = source })
end

-- ── Keymaps ───────────────────────────────────────────────────────────────────
local b = MiniPick.builtin
local e = MiniExtra.pickers

local map = function(lhs, rhs, desc)
	vim.keymap.set("n", lhs, rhs, { silent = true, noremap = true, desc = desc })
end

map("<leader><leader>", pick_files, "Find file")
map("<leader>/", b.grep_live, "Grep in project")
map("<leader>sb", b.buffers, "Switch buffer")
map("<leader>sg", e.git_files, "Find git file")
map("<leader>sh", b.help, "Search help")
map("<leader>sk", e.keymaps, "Search keymaps")
map("<leader>sd", e.diagnostic, "Search diagnostics")
map("<leader>sr", b.resume, "Resume last search")
map("<leader>s.", e.oldfiles, "Recent files")
map("<leader>sc", e.commands, "Search commands")
map("<leader>sn", function()
	pick_files({ source = { cwd = vim.fn.stdpath("config") } })
end, "Search nvim config")
