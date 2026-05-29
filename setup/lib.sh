#!/usr/bin/env bash
# setup/lib.sh — Shared helpers sourced by every step file and main.sh.
# Source this with:  source "$SETUP_DIR/lib.sh"

[[ -n "${SETUP_LIB_LOADED:-}" ]] && return 0
SETUP_LIB_LOADED=1

# ─── Paths ────────────────────────────────────────────────────────────────────
SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SETUP_DIR/.." && pwd)"
export DOTFILES_DIR="$REPO_DIR/dotfiles"
export APPS_JSON="$SETUP_DIR/apps.json"
export SCRIPTS_DIR="$REPO_DIR/scripts"
export SETTHEMACUP="$REPO_DIR"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'
BLUE='\033[34m'; CYAN='\033[36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}==> $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}! $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}"; }
step()    { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }

LOG_FILE="$HOME/setup.log"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$LOG_FILE" 2>/dev/null || true; }

# ─── apps.json helpers — args passed via sys.argv, never embedded in code ─────

# apps_names <key>  → one name per line
apps_names() {
  python3 - "$1" "$APPS_JSON" <<'PYEOF'
import json, sys
key, path = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
for item in data.get(key, []):
    print(item['name'])
PYEOF
}

# apps_pairs <key> <field>  → "<field>:<name>" per line
apps_pairs() {
  python3 - "$1" "$2" "$APPS_JSON" <<'PYEOF'
import json, sys
key, field, path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f:
    data = json.load(f)
for item in data.get(key, []):
    print(item.get(field, '') + ':' + item['name'])
PYEOF
}

# apps_dmg  → "name|url" per line
apps_dmg() {
  python3 - "$APPS_JSON" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for item in data.get('dmg', []):
    print(item['name'] + '|' + item['url'])
PYEOF
}

# apps_smb  → "name|url" per line
apps_smb() {
  python3 - "$APPS_JSON" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for s in data.get('smb', []):
    print(s['name'] + '|' + s['url'])
PYEOF
}

# apps_ai_skills  → "source|desc" per line
apps_ai_skills() {
  python3 - "$APPS_JSON" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for s in data.get('ai_skills', []):
    print(s['source'] + '|' + s['desc'])
PYEOF
}

# ─── Input validation helpers ──────────────────────────────────────────────────

# Reject anything outside safe filesystem chars
validate_name() {
  local name="$1"
  if [[ ! "$name" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    warn "Unsafe name '$name' — skipping."; return 1
  fi
}

# Only allow well-formed smb:// URLs
validate_smb_url() {
  local url="$1"
  if [[ ! "$url" =~ ^smb://[a-zA-Z0-9._/:@-]+$ ]]; then
    warn "Unsafe SMB URL '$url' — skipping."; return 1
  fi
}

# ─── Environment bootstrap ────────────────────────────────────────────────────
bootstrap_env() {
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --use-on-cd --shell bash 2>/dev/null)" || true
  fi
  export PNPM_HOME="$HOME/Library/pnpm"
  case ":$PATH:" in
    *":$PNPM_HOME/bin:"*) ;;
    *) export PATH="$PNPM_HOME/bin:$PATH" ;;
  esac
  if command -v npm >/dev/null 2>&1; then
    local npm_prefix npm_bin
    npm_prefix="$(npm config get prefix 2>/dev/null)"
    if [[ -n "$npm_prefix" && -d "$npm_prefix/bin" ]]; then
      npm_bin="$npm_prefix/bin"
      case ":$PATH:" in
        *":$npm_bin:"*) ;;
        *) export PATH="$npm_bin:$PATH" ;;
      esac
    fi
  fi
}
