# mahi.zsh-theme — two-line prompt (replaces starship).
# ANSI color names only, so the prompt follows the Ghostty theme.
# Git segments use OMZ's async git_prompt_info / git_prompt_status; keep the
# literal $(git_prompt_info) / $(git_prompt_status) in PROMPT or async is lost.

zmodload zsh/datetime
autoload -Uz add-zsh-hook

ZSH_THEME_GIT_PROMPT_PREFIX=" %B%F{cyan} "
ZSH_THEME_GIT_PROMPT_SUFFIX="%f%b"
ZSH_THEME_GIT_PROMPT_DIRTY=""   # status symbols come from git_prompt_status
ZSH_THEME_GIT_PROMPT_CLEAN=""
ZSH_THEME_GIT_PROMPT_UNTRACKED="?"
ZSH_THEME_GIT_PROMPT_MODIFIED="!"
ZSH_THEME_GIT_PROMPT_ADDED="+"
ZSH_THEME_GIT_PROMPT_DELETED="✘"
ZSH_THEME_GIT_PROMPT_RENAMED="»"
ZSH_THEME_GIT_PROMPT_UNMERGED="="
ZSH_THEME_GIT_PROMPT_STASHED="\$"
ZSH_THEME_GIT_PROMPT_AHEAD="⇡"
ZSH_THEME_GIT_PROMPT_BEHIND="⇣"
ZSH_THEME_GIT_PROMPT_DIVERGED="⇕"

# Node version, only inside a package.json project; cached per directory
_mahi_node=""
_mahi_chpwd() {
  _mahi_node=""
  [[ -f package.json ]] && (( $+commands[node] )) && _mahi_node=" %B%F{green} ${$(node -v)#v}%f%b"
}

# Duration of the last command when it took 2s or more
_mahi_preexec() { _mahi_t0=$EPOCHREALTIME }
_mahi_precmd() {
  _mahi_dur=""
  [[ -n $_mahi_t0 ]] || return
  local -i ms=$(( (EPOCHREALTIME - _mahi_t0) * 1000 ))
  unset _mahi_t0
  (( ms >= 2000 )) && _mahi_dur=" %F{8}$(( ms / 1000 ))s%f"
}

add-zsh-hook chpwd _mahi_chpwd
add-zsh-hook preexec _mahi_preexec
add-zsh-hook precmd _mahi_precmd
_mahi_chpwd

PROMPT=$'\n''%B%F{yellow}%(4~|…/%3~|%~)%f%b$(git_prompt_info)%B%F{red}$(git_prompt_status)%f%b${_mahi_node}${_mahi_dur}
%(?.%B%F{green}.%B%F{red})❯%f%b '
RPROMPT=''
