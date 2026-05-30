-- Native vim.pack command wrappers for convenient plugin management
-- Note: :PackAdd omitted per user preference (plugins added via code)

vim.api.nvim_create_user_command("PackDel", function(opts)
	vim.pack.del(opts.fargs)
end, { nargs = "+", desc = "Delete plugins (:PackDel plugin1 plugin2)" })

vim.api.nvim_create_user_command("PackUpdate", function(opts)
	-- Check if any argument is passed
	if opts.args:match("%S") then
		-- Update specific plugins
		local plugins = vim.split(opts.args, "%s+", { trimempty = true })
		-- Update only specified plugins
		vim.pack.update(plugins)
	else
		-- Update all
		vim.pack.update()
	end
end, { nargs = "*", desc = "Update all plugins or specific ones (:PackUpdate) or (:PackUpdate plugin1 plugin2)" })
