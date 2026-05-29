vim.pack.add({
	"https://github.com/rafamadriz/friendly-snippets",
	"https://github.com/saghen/blink.lib",
	"https://github.com/saghen/blink.cmp",
	"https://github.com/supermaven-inc/supermaven-nvim",
})

-- Build Rust fuzzy binary only if cargo is available.
-- prefer_rust falls back to Lua gracefully when binary is absent.
if vim.fn.executable("cargo") == 1 then
	require("blink.cmp").build():wait(60000)
end

require("blink.cmp").setup({
	-- prefer_rust: use Rust binary if available, fall back to Lua gracefully
	-- (requires cargo on first install — see apps.json; lua fallback works without it)
	fuzzy = { implementation = "prefer_rust" },
	snippets = { preset = "mini_snippets" },
	keymap = {
		preset = "default",
	},
	sources = { default = { "lsp", "path", "snippets", "buffer" } },
	cmdline = { enabled = false },
	appearance = { use_nvim_cmp_as_default = false, nerd_font_variant = "mono" },
	signature = { enabled = true },
	completion = {
		documentation = { auto_show = true, auto_show_delay_ms = 150 },
		ghost_text = { enabled = false },
		menu = {
			auto_show = true,
			auto_show_delay_ms = 0,
			draw = {
				treesitter = { "lsp" },
				columns = {
					{ "kind_icon", "label", "label_description", gap = 1 },
					{ "kind" },
				},
			},
		},
	},
})

require("supermaven-nvim").setup({
	ignore_filetypes = {},
	-- color = { suggestion_color = "#6c7086", cterm = 244 },
})
