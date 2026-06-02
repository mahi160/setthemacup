#!/usr/bin/env bash
# tmux-nowplaying — scrolling now-playing widget for tmux status bar.
# Installed to ~/.local/bin/tmux-nowplaying by setup/14-nowplaying.sh.
# Uses nowplaying-cli (brew install nowplaying-cli) to query macOS MediaRemote.
#
# Output when playing  : " ♪ scrolling text "  (scrolls when > MAX chars)
# Output when idle     : (empty — segment disappears)
#
# Scroll speed matches status-interval (1 char/sec via date +%s).
# For smoother scrolling set status-interval 1 in tmux.conf.

MAX=28  # max visible chars before scrolling kicks in

data=$(nowplaying-cli get playbackRate artist title 2>/dev/null)
rate=$(printf '%s' "$data" | awk 'NR==1{print $0}')
artist=$(printf '%s' "$data" | awk 'NR==2{print $0}')
title=$(printf '%s' "$data" | awk 'NR==3{print $0}')

[ "$rate" = "1" ] && [ -n "$artist" ] && [ "$artist" != "null" ] || exit 0

text="$artist - $title"
len=${#text}

if [ "$len" -le "$MAX" ]; then
    printf ' ♪ %s ' "$text"
else
    # Scroll: advance 1 char/sec using wall clock, wrap around with padding
    pad="   "
    padded="${text}${pad}"
    padlen=${#padded}
    pos=$(( $(date +%s) % padlen ))
    # Double the string so we can safely slice across the wrap boundary
    display=$(printf '%s%s' "$padded" "$padded" | awk -v p=$((pos+1)) -v n=$MAX '{print substr($0,p,n)}')
    printf ' ♪ %s… ' "$display"
fi
