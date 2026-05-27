return {
  -- Disable markdown-preview.nvim (62MB Node.js app, superseded by live-preview.nvim)
  { "iamcco/markdown-preview.nvim", enabled = false },

  {
    "brianhuster/live-preview.nvim",
    cmd = { "LivePreview" }, -- lazy: only load when the command is used
  },

  {
    "wakatime/vim-wakatime",
    event = "VeryLazy", -- defer past startup; tracks coding time after nvim is idle
  },
}
