# ─── oh-my-zsh ────────────────────────────────────────────────────────────────
# OMZ lives in ~/.oh-my-zsh (cloned by setup). $ZSH_CUSTOM holds the tracked
# theme; external plugins are cloned into $ZSH_CUSTOM/plugins (gitignored).
# Machine-local aliases go in $ZSH_CUSTOM/local.zsh (auto-sourced, never committed).
export ZSH="$HOME/.oh-my-zsh"
export ZSH_CUSTOM="$HOME/.config/zsh"
ZSH_THEME="mahi"

zstyle ':omz:update' mode auto
zstyle ':omz:update' frequency 14
zstyle ':omz:plugins:fnm' autostart yes   # fnm env --use-on-cd

HIST_STAMPS="yyyy-mm-dd"

# Extra completions — must be on fpath before OMZ runs compinit
fpath=("$ZSH_CUSTOM/plugins/zsh-completions/src" "${HOMEBREW_PREFIX:-/opt/homebrew}/share/zsh/site-functions" $fpath)

# zsh-syntax-highlighting must stay last
plugins=(git brew fnm fzf z gh sudo copypath extract colored-man-pages zsh-autosuggestions zsh-syntax-highlighting)

source "$ZSH/oh-my-zsh.sh"

# ─── History (on top of OMZ defaults) ─────────────────────────────────────────
HISTSIZE=100000
SAVEHIST=100000
setopt hist_ignore_all_dups hist_reduce_blanks

# ─── Aliases ──────────────────────────────────────────────────────────────────
alias v="nvim"
alias lg="lazygit"
alias ld="lazydocker"
alias zc='dev --dir "$SETTHEMACUP" --name config'
alias zs="omz reload"

# --local scope: only affects the current repo, never bleeds across projects
# Identity values come from ~/.config/setthemacup/private.env
alias gp='git config --local user.name "$GIT_NAME" && git config --local user.email "$GIT_EMAIL"'
alias gw='git config --local user.name "$WORK_GIT_NAME" && git config --local user.email "$WORK_GIT_EMAIL"'

alias a='command pi'
alias of="onefetch"
# Helpers (dev, note, vpn, theme, pokemon-bg, setup, …) are linked from $SETTHEMACUP/bin into ~/.local/bin

# ─── Functions ────────────────────────────────────────────────────────────────
# Kill whatever is running on a port: port-kill 3000
function port-kill() {
  local port=${1:?"Usage: port-kill <port>"}
  local pids; pids=$(lsof -ti:"$port" 2>/dev/null)
  [[ -z "$pids" ]] && { echo "Nothing on port $port"; return 0; }
  echo "$pids" | xargs kill -9
  echo "Killed port $port"
}

# Pull latest setup, relink dotfiles, reload shell
function update() {
  git -C "$SETTHEMACUP" pull --ff-only || { echo "✗ git pull failed"; return 1; }
  setup --only dotfiles --yes && omz reload
}

# Alt+Q: cycle Pokemon background
_pokemon_bg_widget() {
  pokemon-bg
  zle reset-prompt
}
zle -N _pokemon_bg_widget
bindkey '\eq' _pokemon_bg_widget

# gh: $WORK_GH_USER under $WORK_DIR, the active gh account (personal) elsewhere
if [[ -n ${WORK_GH_USER:-} && -n ${WORK_DIR:-} ]]; then
  _gh_work_account() {
    if [[ $PWD/ == ${WORK_DIR%/}/* ]]; then
      [[ -n ${_GH_WORK:-} ]] && return
      local token; token=$(gh auth token -u "$WORK_GH_USER" 2>/dev/null) || return
      export GH_TOKEN=$token; _GH_WORK=1
    elif [[ -n ${_GH_WORK:-} ]]; then
      unset GH_TOKEN _GH_WORK
    fi
  }
  autoload -Uz add-zsh-hook
  add-zsh-hook chpwd _gh_work_account
  _gh_work_account
fi

# ─── Environment ──────────────────────────────────────────────────────────────
# pi — extended Anthropic prompt cache (1h instead of 5min)
export PI_CACHE_RETENTION=long
