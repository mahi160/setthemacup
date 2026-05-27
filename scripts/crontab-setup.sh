#!/usr/bin/env bash
# crontab-setup.sh — Install weekly maintenance cron entries.
#
# Idempotent: safe to run multiple times. Existing entries for pi-prune
# and fnm_multishells are replaced, not duplicated.
#
# Jobs installed:
#   - pi-prune:       weekly Sunday 3am — delete pi sessions older than 30 days
#   - fnm-clean:      weekly Sunday 4am — remove stale fnm multishell symlinks
#
# Usage:
#   bash scripts/crontab-setup.sh

set -euo pipefail

REPO="$HOME/Documents/Coding/Projects/setthemacup"

PRUNE_JOB="0 3 * * 0 ${REPO}/scripts/pi-prune.sh >> /tmp/pi-prune.log 2>&1"
FNM_JOB="0 4 * * 0 find \$HOME/.local/state/fnm_multishells -mindepth 1 -maxdepth 1 -mtime +7 -exec rm -rf {} + 2>/dev/null"

# Strip any existing entries for these jobs, then append fresh ones
# Use a temp file to avoid subshell exit-code issues when crontab is empty
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
crontab -l 2>/dev/null | grep -v "pi-prune\|fnm_multishells" > "$TMPFILE" || true
echo "$PRUNE_JOB" >> "$TMPFILE"
echo "$FNM_JOB" >> "$TMPFILE"
crontab "$TMPFILE"

echo "Cron entries installed:"
crontab -l | grep -E "pi-prune|fnm_multishells"
