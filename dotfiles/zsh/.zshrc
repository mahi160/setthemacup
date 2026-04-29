fastfetch
export ZSH="$HOME/.oh-my-zsh"

# Plugins
DISABLE_UNTRACKED_FILES_DIRTY="true"
plugins=(git z zsh-autosuggestions zsh-syntax-highlighting)
source $ZSH/oh-my-zsh.sh

# aliases
alias vm="NVIM_APPNAME=nvim.12 nvim"
alias vi="nvim"
alias ai="claude"
alias zc="vi ~/.zshrc"
alias zs="source ~/.zshrc"
alias ls="eza"
alias ll="eza -la"
alias setup="vi ~/Documents/Coding/Projects/setthemacup/"
alias note="~/Documents/Coding/Projects/setthemacup/scripts/note.sh"
alias wick="~/Documents/Coding/Projects/setthemacup/scripts/wick.sh"
alias dev="~/Documents/Coding/Projects/setthemacup/scripts/dev.sh"
alias pokemon-bg="~/Documents/Coding/Projects/setthemacup/scripts/pokemon-bg.sh"

alias gp="git config user.name \"mahi160\" && git config user.email \"omarsifat288@gamil.com\""
alias gw="git config user.name \"salauddin-sifat-qp\" && git config user.email \"salauddin.sifat@questionpro.com\""

# Alt+Q: change Pokemon background from anywhere in the terminal
_pokemon_bg_widget() {
  ~/Documents/Coding/Projects/setthemacup/scripts/pokemon-bg.sh
  zle reset-prompt
}
zle -N _pokemon_bg_widget
bindkey '\eq' _pokemon_bg_widget

# starship
eval "$(starship init zsh)"

# fzf search
source <(fzf --zsh)

# history
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
setopt appendhistory
setopt sharehistory
setopt incappendhistory
setopt extendedhistory
setopt histignorealldups
setopt histignorespace
setopt histignoredups
setopt histreduceblanks

eval "$(fnm env --use-on-cd --shell zsh)"

# pnpm
export PNPM_HOME="/Users/mahi/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end


# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "/Users/mahi/.bun/_bun" ] && source "/Users/mahi/.bun/_bun"

# Vite+ bin (https://viteplus.dev)
. "$HOME/.vite-plus/env"
