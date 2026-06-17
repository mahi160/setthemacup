#!/usr/bin/env python3
"""
Claude usage widget for tmux status bar — Kanagawa Wave palette, 5-min cache.
Reads credentials from macOS Keychain (stored by setup.py).

Usage in tmux.conf:
  set -g status-right '#(python3 ~/.setup/claude-tmux.py)'
  # status-interval 5 is fine — output is cached to /tmp/.claude-status-cache
"""

import json
import os
import subprocess
import time
import urllib.error
import urllib.request

# ── Config ────────────────────────────────────────────────────────────────────

SERVICE    = "claude-usage-widget"
CACHE_FILE = "/tmp/.claude-status-cache"
CACHE_TTL  = 300  # seconds — actual API calls at most once per 5 min

# ── Kanagawa Wave palette ─────────────────────────────────────────────────────

C_GREEN  = "#98BB6C"   # springGreen
C_YELLOW = "#E6C384"   # carpYellow
C_RED    = "#E82424"   # samuraiRed
C_PURPLE = "#957fb8"   # oniViolet
C_GRAY   = "#727169"   # fujiGray

# ── Helpers ───────────────────────────────────────────────────────────────────

def fg(color: str, text: str) -> str:
    return f"#[fg={color}]{text}#[fg=default]"

def usage_color(pct: float) -> str:
    if pct < 60: return C_GREEN
    if pct < 80: return C_YELLOW
    return C_RED

def session_icon(pct: float) -> str:
    """Pie-fill circle representing 5-hour window usage."""
    if pct < 20: return "○"
    if pct < 40: return "◔"
    if pct < 60: return "◑"
    if pct < 80: return "◕"
    return "●"

def gradient_bar(pct: float, width: int = 8) -> str:
    """
    Traffic-light bar: each segment is colored by its position in the bar,
    not by overall utilisation — so the bar always shows green → yellow → red
    and the fill level shows how much is used.

    Example at 62%:   ▰▰▰▰▰▱▱▱   (green×3, yellow×2, gray×3)
    Example at 85%:   ▰▰▰▰▰▰▰▱   (green×3, yellow×2, red×2, gray×1)
    """
    filled = round(pct / 100 * width)
    out = ""
    for i in range(width):
        cell_pct = (i + 1) / width * 100   # position within full bar
        if i < filled:
            if cell_pct <= 60: color = C_GREEN
            elif cell_pct <= 80: color = C_YELLOW
            else: color = C_RED
            out += f"#[fg={color}]▰"
        else:
            out += f"#[fg={C_GRAY}]▱"
    return out + "#[fg=default]"

def render(five_h: float, seven_d: float) -> str:
    """
    Layout:  ✦  ◑ 45%  ▰▰▰▰▰▰▱▱  72%
             │  │ └5h%  └── 7d gradient bar ─┘  └7d%
             │  └session fill icon
             └spark icon (purple)
    """
    icon    = fg(C_PURPLE, "✦")
    session = fg(usage_color(five_h), f"{session_icon(five_h)} {five_h:.0f}%")
    bar     = gradient_bar(seven_d)
    weekly  = fg(usage_color(seven_d), f"{seven_d:.0f}%")
    sep     = fg(C_GRAY, "│")

    return f" {icon}  {session}  {sep}  {bar}  {weekly} "

# ── Keychain ──────────────────────────────────────────────────────────────────

def keychain_get(account: str) -> str:
    r = subprocess.run(
        ["security", "find-generic-password", "-s", SERVICE, "-a", account, "-w"],
        capture_output=True, text=True,
    )
    return r.stdout.strip() if r.returncode == 0 else ""

# ── Fetch ─────────────────────────────────────────────────────────────────────

def fetch() -> str:
    session_key = keychain_get("session_key")
    org_uuid    = keychain_get("org_uuid")

    if not session_key or not org_uuid:
        return fg(C_RED, "✦ ⚠ no creds")

    try:
        req = urllib.request.Request(
            f"https://claude.ai/api/organizations/{org_uuid}/usage",
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                "Cookie": f"sessionKey={session_key}",
            },
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        return fg(C_RED, f"✦ ⚠ {e.code}")
    except Exception:
        return fg(C_RED, "✦ ⚠ offline")

    five_h  = data.get("five_hour", {}).get("utilization", 0.0)
    seven_d = data.get("seven_day", {}).get("utilization", 0.0)
    return render(five_h, seven_d)

# ── Cache ─────────────────────────────────────────────────────────────────────

def read_cache() -> str | None:
    try:
        age = time.time() - os.path.getmtime(CACHE_FILE)
        if age < CACHE_TTL:
            with open(CACHE_FILE) as f:
                return f.read()
    except OSError:
        pass
    return None

def write_cache(result: str) -> None:
    tmp = CACHE_FILE + ".tmp"
    try:
        with open(tmp, "w") as f:
            f.write(result)
        os.replace(tmp, CACHE_FILE)
    except OSError:
        pass

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    cached = read_cache()
    if cached is not None:
        print(cached, end="")
        return

    result = fetch()
    write_cache(result)
    print(result, end="")

if __name__ == "__main__":
    main()
