# ─── Dotfiles repo location ───────────────────────────────────────────────────
# Update this if you clone the repo to a different path.
# Used by .zshrc aliases (note, dev, pokemon-bg, etc.) and crontab-setup.sh.
export SETTHEMACUP="$HOME/Documents/Coding/Projects/setthemacup"

# ─── PATH additions ───────────────────────────────────────────────────────────
# ~/.local/bin — compiled binaries (e.g. nowplaying-mediaremote for tmux)
export PATH="$HOME/.local/bin:$PATH"

# ─── uv (Python package manager) ──────────────────────────────────────────────
# uv installs tools to ~/.local/bin — already in PATH above
