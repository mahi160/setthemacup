-- colorpeek.lua
-- Virtual-text color swatch on CursorHold.
-- Supports: oklch(), rgb()/rgba(), hsl()/hsla(), #rrggbb, #rgb

local M = {}
local ns = vim.api.nvim_create_namespace("colorpeek")

-- ── math ─────────────────────────────────────────────────────────────────────

local function clamp01(v) return v < 0 and 0 or v > 1 and 1 or v end

local function to_hex(r, g, b)
  local function byte(v) return math.floor(clamp01(v) * 255 + 0.5) end
  return string.format("#%02x%02x%02x", byte(r), byte(g), byte(b))
end

local function oklch_to_rgb(L, C, H)
  local rad = H * math.pi / 180
  local a, b = C * math.cos(rad), C * math.sin(rad)

  local l_ = L + 0.3963377774 * a + 0.2158037573 * b
  local m_ = L - 0.1055613458 * a - 0.0638541728 * b
  local s_ = L - 0.0894841775 * a - 1.2914855480 * b

  local l3, m3, s3 = l_^3, m_^3, s_^3

  local r  =  4.0767416621*l3 - 3.3077115913*m3 + 0.2309699292*s3
  local g  = -1.2684380046*l3 + 2.6097574011*m3 - 0.3413193965*s3
  local bv = -0.0041960863*l3 - 0.7034186147*m3 + 1.7076147010*s3

  local function gamma(c)
    return c >= 0.0031308 and 1.055 * c^(1/2.4) - 0.055 or 12.92 * c
  end
  return gamma(r), gamma(g), gamma(bv)
end

local function hsl_to_rgb(h, s, l)
  h, s, l = h / 360, s / 100, l / 100
  if s == 0 then return l, l, l end
  local function hue(p, q, t)
    if t < 0 then t = t + 1 end
    if t > 1 then t = t - 1 end
    if t < 1/6 then return p + (q - p) * 6 * t end
    if t < 1/2 then return q end
    if t < 2/3 then return p + (q - p) * (2/3 - t) * 6 end
    return p
  end
  local q = l < 0.5 and l * (1 + s) or l + s - l * s
  local p = 2 * l - q
  return hue(p, q, h + 1/3), hue(p, q, h), hue(p, q, h - 1/3)
end

local function expand_hex3(h)
  local r, g, b = h:sub(2,2), h:sub(3,3), h:sub(4,4)
  return "#" .. r..r .. g..g .. b..b
end

-- ── parsers ───────────────────────────────────────────────────────────────────
-- Each entry: { pattern, fn(captures, full_match) -> hex_string }
-- Patterns are tried in order; first hit wins.

local PARSERS = {
  {
    -- oklch(L C H) — L may carry a % suffix (0-100 scale)
    re = "oklch%(([%d%.]+)(%%?)%s+([%d%.]+)%s+([%d%.]+)[^%)]*%)",
    fn = function(c)
      local L = tonumber(c[1])
      if c[2] == "%" then L = L / 100 end
      return to_hex(oklch_to_rgb(L, tonumber(c[3]), tonumber(c[4])))
    end,
  },
  {
    -- rgb(r, g, b) / rgba(r, g, b, a)  — integer 0-255
    re = "rgba?%((%d+)%s*,%s*(%d+)%s*,%s*(%d+)[^%)]*%)",
    fn = function(c)
      return to_hex(tonumber(c[1])/255, tonumber(c[2])/255, tonumber(c[3])/255)
    end,
  },
  {
    -- hsl(h, s%, l%) / hsla(...)
    re = "hsla?%(([%d%.]+)%s*,%s*([%d%.]+)%%%s*,%s*([%d%.]+)%%[^%)]*%)",
    fn = function(c)
      return to_hex(hsl_to_rgb(tonumber(c[1]), tonumber(c[2]), tonumber(c[3])))
    end,
  },
  {
    -- #rrggbb — must not be followed by a hex char (avoids partial #rrggbbaa match)
    re = "#[%x][%x][%x][%x][%x][%x]%f[^%x]",
    fn = function(_, full) return full:lower() end,
  },
  {
    -- #rgb — must not be followed by a hex char
    re = "#[%x][%x][%x]%f[^%x]",
    fn = function(_, full) return expand_hex3(full:lower()) end,
  },
}

-- Returns hex string or nil. col is 0-indexed.
local function color_at(line, col)
  local c = col + 1  -- 1-indexed
  for _, p in ipairs(PARSERS) do
    local s = 1
    while s <= #line do
      local ms, me = line:find(p.re, s)
      if not ms then break end
      if c >= ms and c <= me then
        local full = line:sub(ms, me)
        local caps = { line:match(p.re, ms) }
        local ok, hex = pcall(p.fn, caps, full)
        if ok and hex then return hex end
      end
      s = me + 1
    end
  end
end

-- ── virtual text ──────────────────────────────────────────────────────────────

local function hl_for(hex)
  local name = "ColorPeek_" .. hex:sub(2)
  -- Only set once per unique color
  if vim.fn.hlexists(name) == 0 then
    vim.api.nvim_set_hl(0, name, { bg = hex, fg = hex })
  end
  return name
end

local function show(buf, row, hex)
  vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)
  vim.api.nvim_buf_set_extmark(buf, ns, row, 0, {
    virt_text = {
      { "  ", hl_for(hex) },   -- color block
      { " " .. hex, "Comment" }, -- hex label
    },
    virt_text_pos = "eol",
  })
end

local function clear(buf)
  vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)
end

-- ── setup ─────────────────────────────────────────────────────────────────────

function M.setup()
  local g = vim.api.nvim_create_augroup("colorpeek", { clear = true })

  vim.api.nvim_create_autocmd("CursorHold", {
    group = g,
    callback = function()
      local buf = vim.api.nvim_get_current_buf()
      local pos = vim.api.nvim_win_get_cursor(0)
      local row = pos[1] - 1  -- 0-indexed row
      local col = pos[2]       -- 0-indexed col
      local line = vim.api.nvim_buf_get_lines(buf, row, row + 1, false)[1]
      if not line then return end
      local hex = color_at(line, col)
      if hex then show(buf, row, hex) else clear(buf) end
    end,
  })

  vim.api.nvim_create_autocmd({ "CursorMoved", "CursorMovedI", "InsertEnter" }, {
    group = g,
    callback = function()
      clear(vim.api.nvim_get_current_buf())
    end,
  })
end

return M
