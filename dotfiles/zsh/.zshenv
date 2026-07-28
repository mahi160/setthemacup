# ─── Dotfiles repo location ───────────────────────────────────────────────────
# Cloned here by bootstrap.sh. Change if you move the repo.
# Used by .zshrc aliases (note, dev, pokemon-bg, zc) and crontab-setup.sh.
export SETTHEMACUP="$HOME/.setup"

# ─── pi extensions ────────────────────────────────────────────────────────────
# ask_user (pi-ask-user package): render inline instead of a centered overlay
# popup, closer to Claude Code's native ask flow.
export PI_ASK_USER_DISPLAY_MODE=inline

# ─── PATH additions ───────────────────────────────────────────────────────────
# ~/.local/bin — compiled binaries (e.g. nowplaying-mediaremote for tmux)
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac