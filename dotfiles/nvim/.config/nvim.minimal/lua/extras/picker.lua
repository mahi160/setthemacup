local ok, snacks = pcall(require, "snacks")
if not ok then
  return
end

local map = vim.keymap.set
local picker = function(name, opts)
  return function()
    snacks.picker[name](opts or {})
  end
end

map("n", "<leader>ff", picker("files"), { desc = "Find Files" })
map("n", "<leader>fg", picker("git_files"), { desc = "Git Files" })
map("n", "<leader>fr", picker("recent"), { desc = "Recent Files" })
map("n", "<leader>fb", picker("buffers"), { desc = "Buffers" })
map("n", "<leader>fc", picker("files", { cwd = vim.fn.stdpath("config") }), { desc = "Config Files" })
map("n", "<leader>fe", picker("explorer"), { desc = "File Explorer" })

map("n", "<leader>sg", picker("grep"), { desc = "Grep" })
map("n", "<leader>sw", picker("grep_word"), { desc = "Grep Word" })
map("n", "<leader>sb", picker("grep_buffers"), { desc = "Grep Buffers" })
map("n", "<leader>sl", picker("lines"), { desc = "Buffer Lines" })

map("n", "gd", picker("lsp_definitions"), { desc = "Goto Definition" })
map("n", "gr", picker("lsp_references"), { desc = "References" })
map("n", "gD", picker("lsp_declarations"), { desc = "Goto Declaration" })
map("n", "gI", picker("lsp_implementations"), { desc = "Goto Implementation" })
map("n", "gy", picker("lsp_type_definitions"), { desc = "Type Definition" })
map("n", "<leader>ss", picker("lsp_symbols"), { desc = "Document Symbols" })
map("n", "<leader>sS", picker("lsp_workspace_symbols"), { desc = "Workspace Symbols" })
map("n", "gai", picker("lsp_incoming_calls"), { desc = "Incoming Calls" })
map("n", "gao", picker("lsp_outgoing_calls"), { desc = "Outgoing Calls" })

map("n", "<leader>sd", picker("diagnostics"), { desc = "Diagnostics (all)" })
map("n", "<leader>sD", picker("diagnostics_buffer"), { desc = "Diagnostics (buffer)" })

map("n", "<leader>gs", picker("git_status"), { desc = "Git Status" })
map("n", "<leader>gb", picker("git_branches"), { desc = "Git Branches" })
map("n", "<leader>gl", picker("git_log"), { desc = "Git Log" })
map("n", "<leader>gd", picker("git_diff"), { desc = "Git Diff" })
map("n", "<leader>gf", picker("git_log_file"), { desc = "Git File History" })
map("n", "<leader>gL", picker("git_log_line"), { desc = "Git Line History" })
map("n", "<leader>gS", picker("git_stash"), { desc = "Git Stash" })
map("n", "<leader>gg", picker("git_grep"), { desc = "Git Grep" })

map("n", "<leader>ghi", picker("gh_issue"), { desc = "GitHub Issues" })
map("n", "<leader>ghI", picker("gh_issue", { state = "all" }), { desc = "GitHub Issues (all)" })
map("n", "<leader>ghp", picker("gh_pr"), { desc = "GitHub PRs" })
map("n", "<leader>ghP", picker("gh_pr", { state = "all" }), { desc = "GitHub PRs (all)" })
map("n", "<leader>ghd", picker("gh_diff"), { desc = "GitHub PR Diff" })

map("n", "<leader>sh", picker("help"), { desc = "Help Tags" })
map("n", "<leader>sm", picker("man"), { desc = "Man Pages" })
map("n", "<leader>sk", picker("keymaps"), { desc = "Keymaps" })
map("n", "<leader>sc", picker("commands"), { desc = "Commands" })
map("n", "<leader>sC", picker("command_history"), { desc = "Command History" })
map("n", "<leader>s/", picker("search_history"), { desc = "Search History" })
map("n", "<leader>sa", picker("autocmds"), { desc = "Autocmds" })
map("n", "<leader>sH", picker("highlights"), { desc = "Highlights" })
map("n", "<leader>sn", picker("notifications"), { desc = "Notifications" })
map("n", "<leader>sr", picker("registers"), { desc = "Registers" })
map("n", "<leader>sj", picker("jumps"), { desc = "Jumps" })
map("n", "<leader>sM", picker("marks"), { desc = "Marks" })
map("n", "<leader>sp", picker("projects"), { desc = "Projects" })
map("n", "<leader>si", picker("icons"), { desc = "Icons" })
map("n", "<leader>uC", picker("colorschemes"), { desc = "Colorschemes" })

map("n", "<leader>su", picker("undo"), { desc = "Undo History" })
map("n", "<leader>st", picker("treesitter"), { desc = "Treesitter Symbols" })
map("n", "<leader>sq", picker("qflist"), { desc = "Quickfix List" })
map("n", "<leader>sQ", picker("loclist"), { desc = "Location List" })
map("n", "<leader>sL", picker("lazy"), { desc = "Lazy Plugins" })
map("n", "<leader>sT", picker("tags"), { desc = "Tags" })
map("n", "<leader>sz", picker("spelling"), { desc = "Spelling Suggestions" })

map("n", "<leader>sR", picker("resume"), { desc = "Resume Last Picker" })
