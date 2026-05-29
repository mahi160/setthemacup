# Only show system info in login shells (not tmux splits / agent subshells)
[[ -o login ]] && fastfetch

# ─── Homebrew prefix ──────────────────────────────────────────────────────────
BREW_PREFIX="${HOMEBREW_PREFIX:-/opt/homebrew}"

# ─── Completion ───────────────────────────────────────────────────────────────
# Extra completion definitions (must be before compinit)
fpath=("$BREW_PREFIX/share/zsh/site-functions" "$BREW_PREFIX/share/zsh-completions" $fpath)

autoload -Uz compinit
# Regenerate dump at most once per day; skip security audit in between
if [[ $(find "${HOME}/.zcompdump" -mtime +1 2>/dev/null) ]]; then
  compinit
else
  compinit -C
fi

# ─── Zsh Options ──────────────────────────────────────────────────────────────
setopt autocd autopushd pushdignoredups  # type dir name to cd; maintain dir stack
setopt interactivecomments               # allow # comments in interactive shell

# ─── History ──────────────────────────────────────────────────────────────────
HISTFILE=~/.zsh_history
HISTSIZE=50000
SAVEHIST=50000
setopt appendhistory sharehistory incappendhistory extendedhistory
setopt histignorealldups histignorespace histignoredups histreduceblanks

# ─── Plugins (direct from brew — zero plugin manager overhead) ────────────────
source "$BREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh"
source "$BREW_PREFIX/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"

# ─── Editors ──────────────────────────────────────────────────────────────────
alias v="nvim"
alias vm="NVIM_APPNAME=nvim.12 nvim"
alias lg="lazygit"
alias ld="lazydocker"

# ─── Shell ────────────────────────────────────────────────────────────────────
alias ls="eza"
alias ll="eza -la"
alias zc='dev --dir "$SETTHEMACUP" --name config'
alias zs="source ~/.zshrc"

# ─── Git ──────────────────────────────────────────────────────────────────────
# --local scope: only affects the current repo, never bleeds across projects
alias gp="git config --local user.name \"mahi160\" && git config --local user.email \"omarsifat288@gmail.com\""
alias gw="git config --local user.name \"salauddin-sifat-qp\" && git config --local user.email \"salauddin.sifat@questionpro.com\""

# ─── Tools ────────────────────────────────────────────────────────────────────
alias a='command pi --no-skills'
alias of="onefetch"
alias note="$SETTHEMACUP/scripts/note.sh"
alias dev="$SETTHEMACUP/scripts/dev.sh"
alias wick='dev --dir "$HOME/Documents/Coding/Jobs/QuestionPro/wick-ui" --cmd "pnpm i && cd ./wick-ui-lib && pnpm dev" --window "cd ./wick-ui-lib && pnpm test:ui"'
alias pokemon-bg="$SETTHEMACUP/scripts/pokemon-bg.sh"

# ─── Dev utilities ────────────────────────────────────────────────────────────────────────────

# Kill whatever is running on a port: port-kill 3000
function port-kill() {
  local port=${1:?"Usage: port-kill <port>"}
  local pids; pids=$(lsof -ti:"$port" 2>/dev/null)
  [[ -z "$pids" ]] && { echo "Nothing on port $port"; return 0; }
  echo "$pids" | xargs kill -9
  echo "Killed port $port"
}

# Pull latest setup + restow dotfiles + reload shell
function update() {
  echo "󰆵 Pulling setup..."
  git -C "$SETTHEMACUP" pull --ff-only || { echo "✗ git pull failed"; return 1; }
  echo "󰆵 Restowing dotfiles..."
  bash "$SETTHEMACUP/setup/main.sh" dotfiles
  echo "󰆵 Reloading shell..."
  exec zsh
}

# Delete all local branches already merged into main/master
function branches-clean() {
  local base=${1:-main}
  git branch --merged "$base" \
    | grep -v "^[[:space:]]*\*\|$base\|master\|main\|dev\|develop" \
    | xargs -r git branch -d
  echo "✓ Merged branches cleaned (base: $base)"
}

# ─── yazi: cd into directory on exit ─────────────────────────────────────────
function y() {
  local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
  yazi "$@" --cwd-file="$tmp"
  if cwd="$(command cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
    builtin cd -- "$cwd"
  fi
  rm -f -- "$tmp"
}

# ─── Keybindings ──────────────────────────────────────────────────────────────
# Alt+Q: cycle Pokemon background
_pokemon_bg_widget() {
  "$SETTHEMACUP/scripts/pokemon-bg.sh"
  zle reset-prompt
}
zle -N _pokemon_bg_widget
bindkey '\eq' _pokemon_bg_widget

# ─── Runtimes ─────────────────────────────────────────────────────────────────
eval "$(fnm env --use-on-cd --shell zsh)"

# pnpm — guarded to avoid duplicate PATH entries on re-source
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac

# ─── Prompt & Tools ───────────────────────────────────────────────────────────
eval "$(starship init zsh)"
eval "$(zoxide init zsh)"   # replaces OMZ z plugin — same 'z' command, smarter
source <(fzf --zsh)         # Ctrl+T file search, Alt+C cd — history handled by atuin
eval "$(atuin init zsh --disable-up-arrow)"  # Ctrl+R → fuzzy history (replaces fzf Ctrl+R)

# pi — extended Anthropic prompt cache (1h instead of 5min, big cost/speed win)
export PI_CACHE_RETENTION=long
