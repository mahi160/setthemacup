#!/usr/bin/env bash
# pi-prune.sh — Delete pi session files older than 30 days and checkpoint WAL.
#
# Usage:
#   ./scripts/pi-prune.sh [--dry-run]
#
# What it does:
#   1. Finds *.jsonl session files in ~/.pi/agent/sessions/ older than 30 days
#   2. Deletes them (or lists them in --dry-run mode)
#   3. Checkpoints the stats.db WAL file to keep disk usage low
#
# Safe to run while pi is not active. Do NOT run while a pi session is open.
# Add to cron: 0 3 * * 0 ~/path/to/pi-prune.sh (weekly at 3am Sunday)

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[pi-prune] dry-run mode — no files will be deleted"
fi

SESSIONS_DIR="${HOME}/.pi/agent/sessions"
STATS_DB="${HOME}/.pi/agent/stats.db"
DAYS=30

if [[ ! -d "$SESSIONS_DIR" ]]; then
  echo "[pi-prune] sessions dir not found: $SESSIONS_DIR"
  exit 0
fi

# Count before
total_before=$(find "$SESSIONS_DIR" -name "*.jsonl" 2>/dev/null | wc -l | tr -d ' ')
size_before=$(du -sh "$SESSIONS_DIR" 2>/dev/null | cut -f1)

echo "[pi-prune] sessions dir: $SESSIONS_DIR"
echo "[pi-prune] files before: $total_before ($size_before)"

if $DRY_RUN; then
  echo "[pi-prune] would delete:"
  find "$SESSIONS_DIR" -name "*.jsonl" -mtime "+${DAYS}" -print 2>/dev/null
else
  deleted=0
  while IFS= read -r f; do
    rm -f "$f"
    ((deleted++)) || true
  done < <(find "$SESSIONS_DIR" -name "*.jsonl" -mtime "+${DAYS}" -print 2>/dev/null)
  echo "[pi-prune] deleted $deleted session files older than ${DAYS}d"
fi

# WAL checkpoint
if command -v sqlite3 &>/dev/null && [[ -f "$STATS_DB" ]]; then
  if $DRY_RUN; then
    echo "[pi-prune] would checkpoint WAL: $STATS_DB"
  else
    sqlite3 "$STATS_DB" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null && \
      echo "[pi-prune] WAL checkpoint done" || \
      echo "[pi-prune] WAL checkpoint skipped (db may be locked)"
  fi
fi

if ! $DRY_RUN; then
  total_after=$(find "$SESSIONS_DIR" -name "*.jsonl" 2>/dev/null | wc -l | tr -d ' ')
  size_after=$(du -sh "$SESSIONS_DIR" 2>/dev/null | cut -f1)
  echo "[pi-prune] files after: $total_after ($size_after)"
fi
