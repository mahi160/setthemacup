# mahi.zsh-theme — port of the old starship.toml (two-line prompt).
# ANSI color names only, so the prompt follows the Ghostty theme.
#   user@ip dir  branch(:remote) (hash) [status] <langs> <tools>
#   ❯                                                     <duration>
# Git runs async through OMZ's handler API (_omz_register_handler).

zmodload zsh/datetime
autoload -Uz add-zsh-hook

_mahi_esc() { REPLY=${1//\%/%%} }

# ─── Directory: truncated to repo root, last 3 parts ─────────────────────────
_mahi_dir=""
_mahi_set_dir() {
  local root p
  root=$(command git rev-parse --show-toplevel 2>/dev/null)
  if [[ -n $root ]]; then
    p=${root:t}${${PWD:A}#${root:A}}
  else
    p=${PWD/#$HOME/\~}
  fi
  local -a parts=(${(s:/:)p})
  (( $#parts > 3 )) && p=${(j:/:)parts[-3,-1]}
  _mahi_esc "$p"
  _mahi_dir="%B%F{yellow}$REPLY%f%b"
  [[ -w $PWD ]] || _mahi_dir+="%F{red}None%f"
  _mahi_dir+=" "
}

# ─── Languages + package + docker, detected in cwd ───────────────────────────
_mahi_any() { local -a m; m=( ${~1}(N[1]) ); (( $#m )) }

# _mahi_lang <files-glob> <symbol> <color> <regex> <cmd...>; regex group 1 = version
_mahi_lang() {
  local glob=$1 sym=$2 color=$3 re=$4 ver=""; shift 4
  _mahi_any "$glob" || return
  if (( $+commands[$1] )); then
    local out; out=$("$@" 2>&1)
    [[ $out =~ $re ]] && ver="v${match[1]}"
  fi
  _mahi_ctx+="%B%F{$color}$sym$ver%f%b "
}

_mahi_ctx=""
_mahi_set_ctx() {
  _mahi_ctx=""
  local n='([0-9]+\.[0-9]+(\.[0-9]+)?)'
  local py=python
  (( $+commands[python] )) || py=python3
  _mahi_lang '(package.json|.node-version|.nvmrc|node_modules|*.(js|mjs|cjs|ts|mts|cts))' ' ' green "v$n" node --version
  _mahi_lang '(go.mod|go.sum|go.work|glide.yaml|Gopkg.yml|Gopkg.lock|.go-version|Godeps|*.go)' ' ' cyan "go$n" go version
  _mahi_lang '(requirements.txt|pyproject.toml|Pipfile|setup.py|setup.cfg|tox.ini|__init__.py|.python-version|*.(py|ipynb))' ' ' yellow "Python $n" $py --version
  _mahi_lang '(Cargo.toml|*.rs)' '󱘗 ' red "rustc $n" rustc --version
  _mahi_lang '(pom.xml|build.gradle.kts|build.sbt|.java-version|deps.edn|project.clj|build.boot|.sdkmanrc|*.(java|class|jar|gradle|clj|cljc))' ' ' red "version \"$n" java -version
  _mahi_lang '*.(kt|kts)' ' ' cyan "version $n" kotlin -version
  _mahi_lang '(.lua-version|lua|*.lua)' ' ' cyan "Lua $n" lua -v
  _mahi_lang '(composer.json|.php-version|*.php)' ' ' cyan "PHP $n" php -v
  _mahi_lang '(Gemfile|.ruby-version|*.rb)' ' ' red "ruby $n" ruby -v
  _mahi_lang '(Package.swift|*.swift)' ' ' red "Swift version $n" swift --version
  _mahi_lang '*.zig' ' ' yellow "$n" zig version

  if _mahi_any '(Dockerfile|docker-compose.yml|docker-compose.yaml|compose.yml|compose.yaml)'; then
    local dctx=$DOCKER_CONTEXT
    if [[ -z $dctx && -r ~/.docker/config.json ]] && [[ $(<~/.docker/config.json) =~ '"currentContext"[[:space:]]*:[[:space:]]*"([^"]+)"' ]]; then
      dctx=${match[1]}
    fi
    [[ -n $dctx && $dctx != default ]] && { _mahi_esc "$dctx"; _mahi_ctx+="%B%F{cyan} $REPLY%f%b " }
  fi

  local pv=""
  if [[ -r package.json ]]; then
    local pj=$(<package.json)
    [[ $pj =~ '"private"[[:space:]]*:[[:space:]]*true' ]] ||
      { [[ $pj =~ '"version"[[:space:]]*:[[:space:]]*"([^"]+)"' ]] && pv=${match[1]} }
  elif [[ -r Cargo.toml && $(<Cargo.toml) =~ $'\nversion[[:space:]]*=[[:space:]]*"([^"]+)"' ]]; then
    pv=${match[1]}
  elif [[ -r pyproject.toml && $(<pyproject.toml) =~ $'\nversion[[:space:]]*=[[:space:]]*"([^"]+)"' ]]; then
    pv=${match[1]}
  fi
  [[ -n $pv ]] && { _mahi_esc "$pv"; _mahi_ctx+="%F{8}󰏗 v${REPLY#v}%f " }

  _mahi_lang '(buf.yaml|buf.gen.yaml|buf.work.yaml)' ' ' cyan "$n" buf --version
}

# ─── Env-only segments (aws, conda, nix): cheap, every prompt ────────────────
_mahi_env=""
_mahi_set_env() {
  local e="" prof=${AWS_VAULT:-${AWSU_PROFILE:-${AWSUME_PROFILE:-$AWS_PROFILE}}} reg=${AWS_REGION:-$AWS_DEFAULT_REGION}
  [[ -n $prof$reg ]] && e+="%B%F{yellow}  ${prof//\%/%%}${reg:+(${reg//\%/%%})}%f%b "
  [[ -n $CONDA_DEFAULT_ENV && $CONDA_DEFAULT_ENV != base ]] && e+="%B%F{green} ${CONDA_DEFAULT_ENV//\%/%%}%f%b "
  [[ -n $IN_NIX_SHELL ]] && e+="%B%F{cyan} ${IN_NIX_SHELL}${name:+(${name//\%/%%})}%f%b "
  _mahi_env=$e
}

# ─── Local IP, refreshed at most once a minute ───────────────────────────────
_mahi_ip="" _mahi_ip_at=0
_mahi_set_ip() {
  (( EPOCHSECONDS - _mahi_ip_at < 60 )) && return
  _mahi_ip_at=$EPOCHSECONDS
  local ifc=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
  _mahi_ip=${ifc:+$(ipconfig getifaddr $ifc 2>/dev/null)}
}

_mahi_user=""
_mahi_set_user() {
  _mahi_user="%(!.%B%F{red}.%B%F{green})%n%f%b"
  if [[ -n $_mahi_ip ]]; then
    _mahi_user+=$'%F{8}%{\e[3m%}@'"$_mahi_ip"$'%{\e[23m%}%f '
  else
    _mahi_user+=" "
  fi
}

# ─── Git (async): branch, detached hash, [status] ────────────────────────────
_mahi_git_async() {
  local out
  out=$(GIT_OPTIONAL_LOCKS=0 command git status --porcelain=v2 --branch --show-stash 2>/dev/null) || return
  local line head="" oid="" up="" x y
  local -i ahead=0 behind=0 stash=0 conflicted=0 deleted=0 renamed=0 modified=0 staged=0 untracked=0
  for line in ${(f)out}; do
    case $line in
      '# branch.oid '*)      oid=${line#\# branch.oid } ;;
      '# branch.head '*)     head=${line#\# branch.head } ;;
      '# branch.upstream '*) up=${line#\# branch.upstream } ;;
      '# branch.ab '*)       local -a ab=(${=${line#\# branch.ab }}); ahead=${ab[1]#+}; behind=${ab[2]#-} ;;
      '# stash '*)           stash=${line#\# stash } ;;
      '? '*)                 untracked=1 ;;
      'u '*)                 conflicted=1 ;;
      [12]' '*)
        x=${line[3]} y=${line[4]}
        [[ $x == D || $y == D ]] && deleted=1
        [[ $x == R ]] && renamed=1
        [[ $y == M ]] && modified=1
        [[ $x != . ]] && staged=1 ;;
    esac
  done

  local seg remote=${up#*/}
  if [[ $head == '(detached)' ]]; then
    seg="%B%F{cyan} HEAD%f%b %F{8}(${oid[1,7]})%f "
  else
    [[ -n $up && $remote != $head ]] && head+=":$remote"
    seg="%B%F{cyan} ${head//\%/%%}%f%b "
  fi

  local st=""
  (( conflicted )) && st+='='
  (( stash ))      && st+='$'
  (( deleted ))    && st+='✘'
  (( renamed ))    && st+='»'
  (( modified ))   && st+='!'
  (( staged ))     && st+='+'
  (( untracked ))  && st+='?'
  if (( ahead && behind )); then st+='⇕'
  elif (( ahead )); then st+='⇡'
  elif (( behind )); then st+='⇣'
  fi
  [[ -n $st ]] && seg+="%B%F{red}[$st]%f%b "
  print -rn -- "$seg"
}
_omz_register_handler _mahi_git_async

# ─── Duration (right prompt), starship-style 1h0m5s, 2s minimum ──────────────
_mahi_preexec() { _mahi_t0=$EPOCHREALTIME }
_mahi_precmd() {
  _mahi_set_ip
  _mahi_set_user
  _mahi_set_env
  _mahi_dur=""
  [[ -n $_mahi_t0 ]] || return
  local -i s=$(( EPOCHREALTIME - _mahi_t0 ))
  unset _mahi_t0
  (( s >= 2 )) || return
  local -a u=($(( s / 86400 )) $(( s % 86400 / 3600 )) $(( s % 3600 / 60 )) $(( s % 60 ))) suf=(d h m s)
  local i started=0 d=""
  for i in 1 2 3 4; do
    (( u[i] || started || i == 4 )) && { started=1; d+="${u[i]}${suf[i]}" }
  done
  _mahi_dur="%F{8}$d%f "
}

# ponytail: langs/dir recomputed on cd only; `fnm use` etc. shows after next cd
_mahi_chpwd() { _mahi_set_dir; _mahi_set_ctx }

add-zsh-hook chpwd _mahi_chpwd
add-zsh-hook preexec _mahi_preexec
add-zsh-hook precmd _mahi_precmd
_mahi_chpwd

PROMPT=$'\n''${_mahi_user}${_mahi_dir}${_OMZ_ASYNC_OUTPUT[_mahi_git_async]}${_mahi_ctx}${_mahi_env}
%(?.%B%F{green}.%B%F{red})❯%f%b '
RPROMPT='${_mahi_dur}'
