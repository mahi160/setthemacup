fastfetch
# Add deno completions to search path
# if [[ ":$FPATH:" != *":/home/mahi/.zsh/completions:"* ]]; then export FPATH="/home/mahi/.zsh/completions:$FPATH"; fi
export ZSH="$HOME/.oh-my-zsh"

# Plugins
DISABLE_UNTRACKED_FILES_DIRTY="true"
plugins=(git z zsh-autosuggestions zsh-syntax-highlighting)
# fpath+=${ZSH_CUSTOM:-${ZSH:-~/.oh-my-zsh}/custom}/plugins/zsh-completions/src
source $ZSH/oh-my-zsh.sh

# aliases
# alias vi="~/Documents/Coding/Projects/shikorux/scripts/vi.sh"
alias vi="NVIM_APPNAME=nvim.minimal bob run nightly"
alias vm="nvim"

alias zc="vi ~/.zshrc"
alias zs="source ~/.zshrc"
alias ls="eza"
alias ll="eza -la"

alias setup="vi ~/Documents/Coding/Projects/setthemacup/"
alias note="~/Documents/Coding/Projects/setthemacup/scripts/note.sh"
alias wick="~/Documents/Coding/Projects/setthemacup/scripts/wick.sh"
alias dev="~/Documents/Coding/Projects/setthemacup/scripts/dev.sh"

alias gp="git config user.name \"mahi160\" && git config user.email \"omarsifat288@gamil.com\""
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

# Initialize zsh completions (added by deno install script)
# autoload -Uz compinit
# compinit
eval "$(fnm env --use-on-cd --shell zsh)"

# pnpm
export PNPM_HOME="/Users/mahi/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# bun completions
[ -s "/Users/mahi/.bun/_bun" ] && source "/Users/mahi/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# opencode
export PATH=/Users/mahi/.opencode/bin:$PATH
