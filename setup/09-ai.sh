#!/usr/bin/env bash
# 09-ai.sh — Install AI agent skills listed in apps.json.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_ai() {
  (set -euo pipefail
  step "AI Skills"

  if ! command -v npx >/dev/null 2>&1; then
    warn "npx not found — skipping AI skills."; return 0
  fi

  while IFS='|' read -r source desc; do
    [[ -z "$source" ]] && continue
    info "  $source — $desc"
    if npx --yes skills add "$source" 2>/dev/null; then
      success "Installed: $source"
    else
      warn "Failed: $source  →  retry: npx skills add $source"
    fi
  done < <(apps_ai_skills)

  log "AI skills installed"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_ai; }
