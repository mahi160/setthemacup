# ─── Dotfiles repo location ───────────────────────────────────────────────────
# Cloned here by bootstrap.sh. Change if you move the repo.
# Used by .zshrc aliases (note, dev, pokemon-bg, zc) and crontab-setup.sh.
export SETTHEMACUP="$HOME/.setup"

# ─── PATH additions ───────────────────────────────────────────────────────────
# ~/.local/bin — compiled binaries (e.g. nowplaying-mediaremote for tmux)
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac