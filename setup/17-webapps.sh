#!/usr/bin/env bash
# 17-webapps.sh — Build .app bundles for each entry in apps.json webapps array.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_webapps() {
  step "Web Apps"

  local script="$(dirname "$SETUP_DIR")/scripts/make-webapp.sh"
  [[ -f "$script" ]] || { warn "make-webapp.sh not found at $script"; return 1; }

  mkdir -p "$HOME/Applications/Brave Browser Apps.localized"

  while IFS= read -r name && IFS= read -r url && IFS= read -r icon; do
    [[ -z "$name" ]] && continue
    info "Building $name..."
    bash "$script" "$name" "$url" "$icon" \
      && success "$name.app created." \
      || warn "Failed to build $name.app"
  done < <(python3 - "$APPS_JSON" <<'EOF'
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for app in data.get('webapps', []):
    print(app['name'])
    print(app['url'])
    print(app.get('icon', ''))
EOF
)

  log "Web apps built"
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_webapps; }
