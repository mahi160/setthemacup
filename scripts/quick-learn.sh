#!/usr/bin/env bash
# Quick learn capture popup

set -euo pipefail

read -p "Learn (text #tags): " learn && {
  "$SETTHEMACUP/scripts/note.sh" learn "$learn"
}
