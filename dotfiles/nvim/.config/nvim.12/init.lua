local config = vim.fn.stdpath("config")

for _, file in ipairs(vim.fn.globpath(config .. "/lua", "[0-9]*_*.lua", false, true)) do
	local mod = vim.fn.fnamemodify(file, ":t:r")
	local ok, err = pcall(require, mod)
	if not ok then
		vim.notify(
			"Failed to load module '" .. mod .. "': " .. tostring(err),
			vim.log.levels.ERROR
		)
	end
end

for _, mod in ipairs({ "qol", "qol_mini" }) do
	local ok, err = pcall(require, mod)
	if not ok then
		vim.notify(
			"Failed to load '" .. mod .. "': " .. tostring(err),
			vim.log.levels.ERROR
		)
	end
end
