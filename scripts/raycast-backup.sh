#!/usr/bin/env bash
# raycast-backup.sh — Backup Raycast 2 settings to the setup repo.
#
# Copies the settings databases from Raycast 2's Application Support dir
# into scripts/raycast-data/ which is tracked in git.
#
# .db-shm is skipped (regenerated automatically, not needed for restore).
# .db-wal is included only if non-empty and .db exists.
#
# Run automatically via cron (see crontab-setup.sh).

set -euo pipefail

REPO="${SETTHEMACUP:-$(cd "$(dirname "$(realpath "$0")")" && cd .. && pwd)}"
SRC="$HOME/Library/Application Support/com.raycast-x.macos"
DEST="$REPO/scripts/raycast-data"

[[ ! -d "$SRC" ]] && { echo "[raycast-backup] Raycast 2 not found — skipping."; exit 0; }

mkdir -p "$DEST"

CHANGED=0
for db in settings.db settings_v2.db; do
  src_file="$SRC/$db"
  dst_file="$DEST/$db"
  [[ ! -f "$src_file" ]] && continue

  # Also copy WAL only if small enough (<256KB) — skip if huge (mostly activity data)
  wal="$SRC/${db}-wal"
  dst_wal="$DEST/${db}-wal"
  wal_size=0
  [[ -f "$wal" ]] && wal_size=$(stat -f%z "$wal" 2>/dev/null || echo 0)

  if ! cmp -s "$src_file" "$dst_file" 2>/dev/null; then
    cp "$src_file" "$dst_file"
    CHANGED=1
  fi

  if [[ "$wal_size" -gt 0 && "$wal_size" -lt 262144 ]]; then
    if ! cmp -s "$wal" "$dst_wal" 2>/dev/null; then
      cp "$wal" "$dst_wal"
      CHANGED=1
    fi
  elif [[ -f "$dst_wal" && "$wal_size" -eq 0 ]]; then
    rm -f "$dst_wal"  # WAL was checkpointed — clean up old copy
    CHANGED=1
  fi
done

if [[ "$CHANGED" -eq 0 ]]; then
  echo "[raycast-backup] No changes."; exit 0
fi

echo "[raycast-backup] Settings changed — committing..."
cd "$REPO"
git add scripts/raycast-data/
git diff --cached --quiet && { echo "[raycast-backup] Nothing to commit."; exit 0; }
git commit -m "chore: raycast settings backup $(date '+%Y-%m-%d %H:%M')"
echo "[raycast-backup] Done."
