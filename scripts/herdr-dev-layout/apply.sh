#!/bin/bash
set -euo pipefail

# Herdr plugin action: build the same editor/dev/git workspace layout as
# scripts/herdr.sh, rooted at the current pane's cwd. Bound to prefix+d.
# Fully automatic — no --cmd/--name/--window overrides (use herdr.sh for those).

herdr="${HERDR_BIN_PATH:-herdr}"

command -v jq >/dev/null || { echo "Error: jq not installed." >&2; exit 1; }
[[ -n "${HERDR_PANE_ID:-}" ]] || { echo "Error: missing HERDR_PANE_ID." >&2; exit 1; }

pane_info="$("$herdr" pane get "$HERDR_PANE_ID")"
WORK_DIR="$(jq -r '.result.pane.foreground_cwd // .result.pane.cwd' <<<"$pane_info")"
[[ -n "$WORK_DIR" && "$WORK_DIR" != "null" ]] || { echo "Error: could not resolve pane cwd." >&2; exit 1; }

WS_LABEL="$(basename "$WORK_DIR")"

# ─── Focus if workspace already exists ────────────────────────────────────────
ws_id="$("$herdr" workspace list | jq -r --arg l "$WS_LABEL" '.result.workspaces[] | select(.label==$l) | .workspace_id' | head -1)"
if [[ -n "$ws_id" ]]; then
  "$herdr" workspace focus "$ws_id" >/dev/null
  echo "focused existing workspace '$WS_LABEL'"
  exit 0
fi

# ─── Auto-detect dev command ───────────────────────────────────────────────────
if   [[ -f "$WORK_DIR/bun.lock" ]];          then DEV_CMD="bun dev"
elif [[ -f "$WORK_DIR/pnpm-lock.yaml" ]];    then DEV_CMD="pnpm dev"
elif [[ -f "$WORK_DIR/package-lock.json" ]]; then DEV_CMD="npm run dev"
else DEV_CMD="pnpm dev"
fi

# ─── Build workspace ──────────────────────────────────────────────────────────
created="$("$herdr" workspace create --cwd "$WORK_DIR" --label "$WS_LABEL" --no-focus)"
ws_id="$(jq -r '.result.workspace.workspace_id' <<<"$created")"
tab1="$(jq -r '.result.tab.tab_id' <<<"$created")"
pane1="$(jq -r '.result.root_pane.pane_id' <<<"$created")"

# Tab 1: editor
"$herdr" tab rename "$tab1" editor >/dev/null
"$herdr" pane run "$pane1" "v ." >/dev/null

# Tab 2: dev — left 80% agent | right 20% top dev server, bottom shell
tab2="$("$herdr" tab create --workspace "$ws_id" --cwd "$WORK_DIR" --label dev --no-focus)"
tab2_pane1="$(jq -r '.result.root_pane.pane_id' <<<"$tab2")"
"$herdr" pane run "$tab2_pane1" "a" >/dev/null
tab2_pane2="$("$herdr" pane split --pane "$tab2_pane1" --direction right --ratio 0.2 --cwd "$WORK_DIR" --no-focus | jq -r '.result.pane.pane_id')"
"$herdr" pane run "$tab2_pane2" "$DEV_CMD" >/dev/null
"$herdr" pane split --pane "$tab2_pane2" --direction down --cwd "$WORK_DIR" --no-focus >/dev/null

# Tab 3: git
tab3="$("$herdr" tab create --workspace "$ws_id" --cwd "$WORK_DIR" --label git --no-focus)"
tab3_pane1="$(jq -r '.result.root_pane.pane_id' <<<"$tab3")"
"$herdr" pane run "$tab3_pane1" "lazygit" >/dev/null

# ─── Focus ────────────────────────────────────────────────────────────────────
"$herdr" workspace focus "$ws_id" >/dev/null
"$herdr" tab focus "$tab1" >/dev/null
echo "created dev layout for '$WS_LABEL'"
