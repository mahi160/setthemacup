# ─── Dotfiles repo location ───────────────────────────────────────────────────
# Cloned here by bootstrap.sh. Change if you move the repo.
# Used by bin/ helpers, the installer and .zshrc.
export SETTHEMACUP="$HOME/.setup"

# Private, machine-local values (identity, work dir, notes, SMB) — never committed.
# Template: $SETTHEMACUP/private.env.example
[[ -f "$HOME/.config/setthemacup/private.env" ]] && { set -a; source "$HOME/.config/setthemacup/private.env"; set +a; }

# ─── pi extensions ────────────────────────────────────────────────────────────
# ask_user (pi-ask-user package): render inline instead of a centered overlay
# popup, closer to Claude Code's native ask flow.
export PI_ASK_USER_DISPLAY_MODE=inline

# ─── lazygit ──────────────────────────────────────────────────────────────────
# theme.yml: symlink to active theme overlay, managed by bin/theme
export LG_CONFIG_FILE="$HOME/.config/lazygit/config.yml,$HOME/.config/lazygit/theme.yml"

# ─── PATH additions ───────────────────────────────────────────────────────────
# ~/.local/bin — helpers linked from $SETTHEMACUP/bin + compiled Swift binaries
# ~/.local/share/fnm — fnm (installed by bootstrap.sh, not Homebrew)
# $PNPM_HOME/bin — pnpm global packages (pi, …)
export PNPM_HOME="$HOME/Library/pnpm"
for _p in "$HOME/.local/share/fnm" "$PNPM_HOME/bin" "$HOME/.local/bin"; do
  case ":$PATH:" in
    *":$_p:"*) ;;
    *) export PATH="$_p:$PATH" ;;
  esac
done
unset _p