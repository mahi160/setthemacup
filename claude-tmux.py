#!/usr/bin/env python3
"""
Claude usage for tmux status bar.
Reads credentials from macOS Keychain (stored by setup.py).
Add to ~/.tmux.conf:
  set -g status-right '#(python3 ~/.setup/claude-tmux.py)'
  set -g status-interval 300
"""

import json
import subprocess
import urllib.error
import urllib.request

SERVICE = "claude-usage-widget"

COLOR_GREEN  = "#98BB6C"  # springGreen
COLOR_YELLOW = "#E6C384"  # carpYellow
COLOR_RED    = "#E82424"  # samuraiRed


def keychain_get(account: str) -> str:
    r = subprocess.run(
        ["security", "find-generic-password", "-s", SERVICE, "-a", account, "-w"],
        capture_output=True, text=True,
    )
    return r.stdout.strip() if r.returncode == 0 else ""


def session_fill(u: float) -> str:
    if u < 20: return "○"
    if u < 40: return "◔"
    if u < 60: return "◑"
    if u < 80: return "◕"
    return "●"


def weekly_color(u: float) -> str:
    if u < 60: return COLOR_GREEN
    if u < 80: return COLOR_YELLOW
    return COLOR_RED


def tmux(color: str, text: str) -> str:
    return f"#[fg={color}]{text}#[default]"


def main():
    session_key = keychain_get("session_key")
    org_uuid    = keychain_get("org_uuid")

    if not session_key or not org_uuid:
        print(tmux(COLOR_RED, "⚠ claude"))
        return

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
        print(tmux(COLOR_RED, f"⚠ {e.code}"))
        return
    except Exception:
        print(tmux(COLOR_RED, "⚠ claude"))
        return

    five_h_util  = data.get("five_hour", {}).get("utilization", 0.0)
    seven_d_util = data.get("seven_day", {}).get("utilization", 0.0)

    print(tmux(weekly_color(seven_d_util), f"{session_fill(five_h_util)} {five_h_util:.0f}% · 7d {seven_d_util:.0f}%"))


if __name__ == "__main__":
    main()
