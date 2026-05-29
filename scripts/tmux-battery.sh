#!/usr/bin/env bash
# tmux-battery — battery icon + percentage for tmux status bar (macOS)
# Installed to ~/.local/bin/tmux-battery by setup/14-nowplaying.sh

output=$(pmset -g batt 2>/dev/null)
pct=$(echo "$output" | grep -Eo '[0-9]+%' | head -1)
[[ -z "$pct" ]] && exit 0

if echo "$output" | grep -q "charging"; then
  icon="󰂄"
elif echo "$output" | grep -q "charged\|AC attached"; then
  icon="󰚥"
else
  icon="󰁹"
fi

printf "%s %s" "$icon" "$pct"
