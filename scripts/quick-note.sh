#!/usr/bin/env bash
# Quick note capture popup

set -euo pipefail

read -p "Note (text #tags): " note && {
  "$SETTHEMACUP/scripts/note.sh" note "$note"
}
