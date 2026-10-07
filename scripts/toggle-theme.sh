#!/usr/bin/env bash
# toggle-theme — cycle gruvbox -> kanagawa-wave -> everforest across ghostty, tmux, nvim, pi, lazygit.
#
# Usage: theme                     next theme in THEMES order
#        theme <name>
#        theme status              print current theme
#        add --no-reload to skip live reload of running apps (used by setup)
#
# State lives in ~/.config/theme. Readers: nvim (both configs), tmux-git,
# claude-tmux.py, pi-stats report. Apps without a state reader get a
# gitignored pointer to a tracked per-theme file (see .gitignore).
set -euo pipefail

THEMES=(gruvbox kanagawa-wave everforest)
DEFAULT=kanagawa-wave
STATE="$HOME/.config/theme"
DOTFILES="$(cd "$(dirname "$0")/.." && pwd)/dotfiles"
USAGE="usage: theme [$(IFS='|'; echo "${THEMES[*]}")|status] [--no-reload]"

reload=1
arg=""
for a in "$@"; do
  case "$a" in
    --no-reload) reload=0 ;;
    *) arg="$a" ;;
  esac
done

current=$(cat "$STATE" 2>/dev/null || echo "$DEFAULT")

case "$arg" in
  status) echo "$current"; exit 0 ;;
  "")
    next="${THEMES[0]}"
    for i in "${!THEMES[@]}"; do
      [[ "${THEMES[$i]}" == "$current" ]] && next="${THEMES[$(((i + 1) % ${#THEMES[@]}))]}"
    done
    ;;
  *)
    next=""
    for t in "${THEMES[@]}"; do [[ "$t" == "$arg" ]] && next="$arg"; done
    [[ -n "$next" ]] || { echo "$USAGE" >&2; exit 1; }
    ;;
esac

mkdir -p "$(dirname "$STATE")"
printf '%s\n' "$next" >"$STATE"

ln -sfn "theme.d/$next" "$DOTFILES/ghostty/.config/ghostty/theme"
ln -sfn "theme.d/$next.conf" "$DOTFILES/tmux/.config/tmux/theme.conf"
ln -sfn "theme.d/$next.yml" "$DOTFILES/lazygit/.config/lazygit/theme.yml"

# pi: renamed copy, file name must equal theme name; pi hot-reloads it
pi_themes="$DOTFILES/pi/.pi/agent/themes"
case "$next" in
  gruvbox) pi_src=gruvbox-material colors=gruvbox-material ;;
  kanagawa-wave) pi_src=kanagawa-wave colors=kanagawa ;;
  everforest) pi_src=everforest colors=everforest ;;
esac
sed 's/"name": *"[^"]*"/"name": "current"/' "$pi_themes/$pi_src.json" >"$pi_themes/current.json"

echo "theme: $next"
[[ "$reload" == 1 ]] || exit 0

# claude-tmux.py caches colored output 5 min
rm -f /tmp/.claude-status-cache

if tmux list-sessions >/dev/null 2>&1; then
  tmux source-file "$HOME/.config/tmux/theme.conf"
  tmux refresh-client -S 2>/dev/null || true
fi

while IFS= read -r sock; do
  timeout 2 nvim --server "$sock" --remote-expr "execute('colorscheme $colors')" >/dev/null 2>&1 || true
done < <(find "${TMPDIR:-/tmp}" -path "*nvim.$USER*" -type s -name 'nvim.*' 2>/dev/null)

if pgrep -xq ghostty; then
  osascript \
    -e 'tell application "Ghostty" to activate' \
    -e 'tell application "System Events" to keystroke "," using {command down, shift down}' \
    >/dev/null 2>&1 || echo "ghostty: press cmd+shift+, to reload" >&2
fi
