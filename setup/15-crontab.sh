#!/usr/bin/env bash
# 15-crontab.sh — Install weekly maintenance cron jobs.
#
# Jobs:
#   pi-prune   — Sunday 03:00 — delete pi sessions older than 30 days
#   fnm-clean  — Sunday 04:00 — remove stale fnm multishell symlinks
#
# Idempotent: existing entries are replaced, not duplicated.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_crontab() {
  step "Crontab"

  local pi_prune="$SCRIPTS_DIR/pi-prune.sh"
  local fnm_dir="$HOME/.local/state/fnm_multishells"

  if [[ ! -f "$pi_prune" ]]; then
    warn "pi-prune.sh not found at $pi_prune — skipping cron registration."
    return 0
  fi

  # Single-quote paths so spaces in $HOME or $SCRIPTS_DIR don't break cron parsing
  local prune_job="0 3 * * 0 '${pi_prune}' >> /tmp/pi-prune.log 2>&1"
  local fnm_job="0 4 * * 0 find '${fnm_dir}' -mindepth 1 -maxdepth 1 -mtime +7 -exec rm -rf {} + 2>/dev/null"

  local tmpfile; tmpfile="$(mktemp)"
  trap 'rm -f "$tmpfile"' RETURN

  # Strip old entries, append fresh ones
  crontab -l 2>/dev/null \
    | grep -v "pi-prune\|fnm_multishells\|fnm-clean" \
    > "$tmpfile" || true
  echo "$prune_job" >> "$tmpfile"
  echo "$fnm_job"   >> "$tmpfile"
  crontab "$tmpfile"

  success "Cron jobs installed."
  info "Installed entries:"
  crontab -l | grep -E "pi-prune|fnm_multishells|fnm-clean" | while IFS= read -r line; do
    echo "  $line"
  done
  log "Crontab setup complete"
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_crontab; }
