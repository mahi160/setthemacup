#!/usr/bin/env bash
# tmux-git — coloured git status + folder size widget for tmux status bar.
# Installed to ~/.local/bin/tmux-git by setup/14-nowplaying.sh.
# Usage: tmux-git <path>
#
# Uses tmux #[fg=hex] style codes (not ANSI) — processed by tmux format engine.
#
# Output examples:
#   ⎇ main  1.2M
#   ⎇ main ↑2  1.2M
#   ⎇ main ~5 ?2  892K

# Theme-aware colours — reads ~/.config/kanagawa-variant
VARIANT=$(cat "$HOME/.config/kanagawa-variant" 2>/dev/null || echo "wave")

if [[ "$VARIANT" == "lotus" ]]; then
  B='#[fg=#4d699b]'  # lotusBlue4   — branch
  G='#[fg=#6f894e]'  # lotusGreen   — ahead ↑
  Y='#[fg=#cc6d00]'  # lotusOrange  — modified ~
  R='#[fg=#c84053]'  # lotusRed     — untracked ?
  D='#[fg=#716e61]'  # lotusGray2   — size
else
  B='#[fg=#7e9cd8]'  # crystalBlue  — branch
  G='#[fg=#98bb6c]'  # springGreen  — ahead ↑
  Y='#[fg=#e6c384]'  # carpYellow   — modified ~
  R='#[fg=#e46876]'  # waveRed      — untracked ?
  D='#[fg=#727169]'  # fujiGray     — size
fi
X='#[fg=default]'  # reset

path="${1:-.}"
branch=$(timeout 2 git -C "$path" branch --show-current 2>/dev/null)
[ -z "$branch" ] && exit 0

ahead=$(timeout 2 git -C "$path" rev-list --count "@{u}..HEAD" 2>/dev/null)

gitstatus=$(timeout 2 git -C "$path" status --porcelain 2>/dev/null)
modified=$(printf '%s\n' "$gitstatus" | grep -v '^??' | grep -c '.' 2>/dev/null || echo 0)
untracked=$(printf '%s\n' "$gitstatus" | grep -c '^??' 2>/dev/null || echo 0)

size=$(timeout 1 du -sh "$path" 2>/dev/null | awk '{print $1}')

out="${B}⎇ $branch${X}"
[ -n "$ahead" ]        && [ "$ahead" -gt 0 ]    && out="$out ${G}↑${ahead}${X}"
[ "$modified" -gt 0 ]  && out="$out ${Y}~${modified}${X}"
[ "$untracked" -gt 0 ] && out="$out ${R}?${untracked}${X}"
[ -n "$size" ]         && out="$out ${D} ${size}${X}"

printf '%s' "$out"
