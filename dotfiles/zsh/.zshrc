fastfetch

# ─── Oh My Zsh ────────────────────────────────────────────────────────────────
export ZSH="$HOME/.oh-my-zsh"
DISABLE_UNTRACKED_FILES_DIRTY="true"
plugins=(git z zsh-autosuggestions zsh-syntax-highlighting)
source $ZSH/oh-my-zsh.sh

# ─── History ──────────────────────────────────────────────────────────────────
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
setopt appendhistory sharehistory incappendhistory extendedhistory
setopt histignorealldups histignorespace histignoredups histreduceblanks

# ─── Editors ──────────────────────────────────────────────────────────────────
alias v="nvim"
alias vm="NVIM_APPNAME=nvim.12 nvim"

# ─── Shell ────────────────────────────────────────────────────────────────────
alias ls="eza"
alias ll="eza -la"
alias zc='dev --dir "$HOME/Documents/Coding/Projects/setthemacup" --name config'
alias zs="source ~/.zshrc"

# ─── Git ──────────────────────────────────────────────────────────────────────
alias gp="git config user.name \"mahi160\" && git config user.email \"omarsifat288@gmail.com\""
alias gw="git config user.name \"salauddin-sifat-qp\" && git config user.email \"salauddin.sifat@questionpro.com\""

# ─── Tools ────────────────────────────────────────────────────────────────────
alias a="pi"
alias of="onefetch"
alias setup="zc"
alias note="~/Documents/Coding/Projects/setthemacup/scripts/note.sh"
alias dev="~/Documents/Coding/Projects/setthemacup/scripts/dev.sh"
alias wick='dev --dir "$HOME/Documents/Coding/Jobs/QuestionPro/wick-ui" --cmd "pnpm i && cd ./wick-ui-lib && pnpm dev" --window "cd ./wick-ui-lib && pnpm test:ui"'
alias pokemon-bg="~/Documents/Coding/Projects/setthemacup/scripts/pokemon-bg.sh"

# yazi: cd into directory on exit
function y() {
  local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
  yazi "$@" --cwd-file="$tmp"
  if cwd="$(command cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
    builtin cd -- "$cwd"
  fi
  rm -f -- "$tmp"
}

# ─── Keybindings ─────────────────────────────────────────────────────────────
# Alt+Q: cycle Pokemon background
_pokemon_bg_widget() {
  ~/Documents/Coding/Projects/setthemacup/scripts/pokemon-bg.sh
  zle reset-prompt
}
zle -N _pokemon_bg_widget
bindkey '\eq' _pokemon_bg_widget

# ─── Runtimes ─────────────────────────────────────────────────────────────────
eval "$(fnm env --use-on-cd --shell zsh)"

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

# cargo
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

# ─── Prompt & Tools ───────────────────────────────────────────────────────────
eval "$(starship init zsh)"
eval "$(thefuck --alias)"
source <(fzf --zsh)

# bun completions
[ -s "/Users/mahi/.bun/_bun" ] && source "/Users/mahi/.bun/_bun"

# opencode
export PATH=/Users/mahi/.opencode/bin:$PATH

# pi — extended Anthropic prompt cache (1h instead of 5min, big cost/speed win)
export PI_CACHE_RETENTION=long
