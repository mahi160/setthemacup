#!/usr/bin/env bash
# 13-network.sh — Create LaunchAgents that auto-mount SMB shares on login.
#
# Security:
#   - share names validated: [a-zA-Z0-9._-] only (path traversal prevention)
#   - SMB URLs validated: smb://[a-zA-Z0-9._/:@-] only (injection prevention)
#   - mount scripts written with quoted heredoc (<<'SCRIPT') so no shell
#     expansion occurs on user-controlled data during generation

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_network() {
  (set -euo pipefail
  step "Network Shares"
  mkdir -p "$HOME/Library/LaunchAgents"

  while IFS='|' read -r name url; do
    [[ -z "$name" ]] && continue

    # ── Input validation ─────────────────────────────────────────────────────
    validate_name    "$name" || continue
    validate_smb_url "$url"  || continue

    local safe_name; safe_name="$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')"
    local label="com.mahi.mount.${safe_name}"
    local plist="$HOME/Library/LaunchAgents/${label}.plist"
    local mount_point="/Volumes/${name}"   # safe: name validated above
    local host; host="$(echo "$url" | sed 's|smb://||' | cut -d'/' -f1)"
    local mount_script="$HOME/Library/LaunchAgents/${label}.sh"

    sudo mkdir -p "$mount_point" 2>/dev/null || warn "Could not create $mount_point."

    # ── Write mount helper script ────────────────────────────────────────────
    # Quoted heredoc (<<'SCRIPT') — no shell expansion, so $url/$name/$host
    # values are NOT interpolated here. We write them as literal assignments
    # on the next lines using printf, then append the rest with a quoted heredoc.
    {
      printf '#!/bin/bash\n'
      printf 'MOUNT_POINT=%s\n' "$(printf '%q' "$mount_point")"
      printf 'URL=%s\n'         "$(printf '%q' "$url")"
      printf 'HOST=%s\n'        "$(printf '%q' "$host")"
      printf 'LOG=%s\n'         "$(printf '%q' "/tmp/${name}-mount.log")"
      cat <<'SCRIPT'
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }
if mount | grep -q "$MOUNT_POINT"; then log "Already mounted"; exit 0; fi
log "Waiting for $HOST..."
for i in $(seq 1 6); do
  ping -c1 -W2 "$HOST" &>/dev/null && break
  log "  attempt $i — waiting 5s..."; sleep 5
done
if ! ping -c1 -W2 "$HOST" &>/dev/null; then log "Host unreachable — skipping."; exit 1; fi
log "Mounting $URL → $MOUNT_POINT"
/sbin/mount_smbfs -o nobrowse "$URL" "$MOUNT_POINT" >> "$LOG" 2>&1 && log "Mounted." || {
  log "mount_smbfs failed — trying Finder..."
  /usr/bin/open "$URL" >> "$LOG" 2>&1 || log "Finder open also failed."
}
SCRIPT
    } > "$mount_script"
    chmod +x "$mount_script"

    # ── Write LaunchAgent plist ──────────────────────────────────────────────
    # Plist values use validated/sanitised variables only.
    cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
    <key>Label</key><string>${label}</string>
    <key>ProgramArguments</key><array>
        <string>/bin/bash</string><string>${mount_script}</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>StandardOutPath</key><string>/tmp/${name}-mount.log</string>
    <key>StandardErrorPath</key><string>/tmp/${name}-mount.log</string>
</dict></plist>
PLIST

    launchctl unload "$plist" 2>/dev/null || true
    launchctl load   "$plist"
    success "${name} — LaunchAgent registered."
    info "  Mount point : $mount_point"
    info "  Server      : $url"
    info "  Log         : /tmp/${name}-mount.log"
    echo ""
    warn "  Credentials: add once to Keychain Access — Kind: Network Password"
    warn "    Server: $host  Account: <username>  Password: <password>"
    echo ""
    log "Network share configured: $name → $url"
  done < <(apps_smb)

  log "Network shares complete"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_network; }
