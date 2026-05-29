#!/usr/bin/env bash
# tmux-cpu — CPU icon + usage percentage for tmux status bar (macOS)
# Installed to ~/.local/bin/tmux-cpu by setup/14-nowplaying.sh

cores=$(sysctl -n hw.logicalcpu 2>/dev/null || echo 1)
pct=$(ps -A -o %cpu | awk -v c="$cores" '{s+=$1} END {printf "%.0f", s/c}')

if (( pct > 80 )); then icon="󰀪"
elif (( pct > 40 )); then icon="󰾅"
else icon="󰾆"
fi

printf "%s %s%%" "$icon" "$pct"
