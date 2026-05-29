#!/usr/bin/env bash
# crontab-setup.sh — Install weekly maintenance cron entries.
#
# Idempotent: safe to run multiple times. Existing entries are replaced, not duplicated.
#
# Jobs installed:
#   - pi-prune:   weekly Sunday 3am — delete pi sessions older than 30 days
#   - fnm-clean:  weekly Sunday 4am — remove stale fnm multishell symlinks
# Note: raycast-backup is a launchd agent (not cron) — runs hourly on wake
#
# Usage:
#   bash scripts/crontab-setup.sh

set -euo pipefail

# Use SETTHEMACUP env var if set, otherwise derive from this script's location
REPO="${SETTHEMACUP:-$(cd "$(dirname "$(realpath "$0")")" && cd .. && pwd)}"

# Expand $HOME now — cron does not expand $HOME or ~ at runtime
EXPANDED_HOME="$HOME"
FNM_DIR="$EXPANDED_HOME/.local/state/fnm_multishells"

PRUNE_JOB="0 3 * * 0 ${REPO}/scripts/pi-prune.sh >> /tmp/pi-prune.log 2>&1"
FNM_JOB="0 4 * * 0 find ${FNM_DIR} -mindepth 1 -maxdepth 1 -mtime +7 -exec rm -rf {} + 2>/dev/null"

# Strip any existing entries for these jobs, then append fresh ones
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
crontab -l 2>/dev/null | grep -v "pi-prune\|fnm_multishells\|fnm-clean" > "$TMPFILE" || true
echo "$PRUNE_JOB" >> "$TMPFILE"
echo "$FNM_JOB"   >> "$TMPFILE"
crontab "$TMPFILE"

echo "Cron entries installed:"
crontab -l | grep -E "pi-prune|fnm_multishells|fnm-clean"