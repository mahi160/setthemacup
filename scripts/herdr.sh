#!/bin/bash

# ─── Usage ────────────────────────────────────────────────────────────────────
# herdr.sh [options]
#   --dir  <path>   working directory     (default: cwd)
#   --cmd  <cmd>    dev server command    (default: auto-detect from lockfile)
#   --name <name>   workspace label       (default: basename of dir)
#   --window <cmd>  extra tab + cmd       (repeatable)
#   --worktree <branch>        create/reuse a herdr worktree workspace for <branch>
#   --remove-worktree <branch> remove the worktree + its workspace
#
# Same shape as dev.sh, built on `herdr` (workspace/tab/pane) instead of tmux.
# Requires: herdr, jq. Assumes a herdr server is already running (it manages
# its own persistence — this script just talks to the socket API).
#
# Examples:
#   herdr.sh
#   herdr.sh --dir ~/projects/myapp
#   herdr.sh --cmd "bun run start"
#   herdr.sh --window "pnpm test" --window "pnpm lint"
#   herdr.sh --worktree feature-x
#   herdr.sh --remove-worktree feature-x

# ─── Defaults ─────────────────────────────────────────────────────────────────
WORK_DIR="$(pwd)"
WS_LABEL=""
DEV_CMD=""
EXTRA_WINDOWS=()
WORKTREE_BRANCH=""
RM_WORKTREE_BRANCH=""

# ─── Parse flags ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)    WORK_DIR="$2";          shift 2 ;;
    --cmd)    DEV_CMD="$2";           shift 2 ;;
    --name)   WS_LABEL="$2";          shift 2 ;;
    --window) EXTRA_WINDOWS+=("$2");  shift 2 ;;
    --worktree)        WORKTREE_BRANCH="$2";    shift 2 ;;
    --remove-worktree) RM_WORKTREE_BRANCH="$2"; shift 2 ;;
    *)
      echo "Unknown flag: $1"
      echo "Usage: herdr.sh [--dir <path>] [--cmd <cmd>] [--name <name>] [--window <cmd>]..."
      exit 1
      ;;
  esac
done

command -v herdr >/dev/null || { echo "Error: herdr not installed."; exit 1; }
command -v jq    >/dev/null || { echo "Error: jq not installed."; exit 1; }

# ─── Resolve ──────────────────────────────────────────────────────────────────
WORK_DIR="$(cd "$WORK_DIR" 2>/dev/null && pwd)" || {
  echo "Error: directory '$WORK_DIR' not found."
  exit 1
}

# ─── Worktrees ────────────────────────────────────────────────────────────────
# ponytail: herdr already models a worktree as a workspace, no extra bookkeeping
if [[ -n "$RM_WORKTREE_BRANCH" ]]; then
  repo_root="$(git -C "$WORK_DIR" rev-parse --show-toplevel 2>/dev/null)" || { echo "Error: not a git repo."; exit 1; }
  entry="$(herdr worktree list --cwd "$repo_root" 2>/dev/null | jq -c --arg b "$RM_WORKTREE_BRANCH" '.result.worktrees[] | select(.branch==$b)')"
  ws_id="$(jq -r '.open_workspace_id // empty' <<<"$entry")"
  wt_path="$(jq -r '.path // empty' <<<"$entry")"
  if [[ -n "$ws_id" ]]; then
    herdr worktree remove --workspace "$ws_id" --force
  else
    # not tracked as an open workspace — fall back to plain git
    wt_path="${wt_path:-$HOME/.worktrees/$(basename "$repo_root")/${RM_WORKTREE_BRANCH//\//-}}"
    git -C "$repo_root" worktree remove "$wt_path" --force 2>/dev/null || rm -rf "$wt_path"
  fi
  echo "Removed worktree '$RM_WORKTREE_BRANCH'"
  exit 0
fi

if [[ -n "$WORKTREE_BRANCH" ]]; then
  repo_root="$(git -C "$WORK_DIR" rev-parse --show-toplevel 2>/dev/null)" || { echo "Error: not a git repo."; exit 1; }
  repo_name="$(basename "$repo_root")"
  slug="${WORKTREE_BRANCH//\//-}"
  wt_path="$HOME/.worktrees/$repo_name/$slug"
  WS_LABEL="${WS_LABEL:-${repo_name}-${slug}}"

  existing="$(herdr worktree list --cwd "$repo_root" 2>/dev/null | jq -r --arg b "$WORKTREE_BRANCH" '.result.worktrees[] | select(.branch==$b) | .open_workspace_id // empty')"
  if [[ -n "$existing" ]]; then
    ws_id="$existing"
  else
    is_new=1
    [[ -d "$wt_path" ]] && is_new=0
    mkdir -p "$(dirname "$wt_path")"
    created="$(herdr worktree create --cwd "$repo_root" --branch "$WORKTREE_BRANCH" --path "$wt_path" --label "$WS_LABEL" --no-focus)" || exit 1
    ws_id="$(jq -r '.result.workspace.workspace_id' <<<"$created")"
    tab1="$(jq -r '.result.tab.tab_id' <<<"$created")"
    pane1="$(jq -r '.result.root_pane.pane_id' <<<"$created")"

    if [[ "$is_new" == 1 ]]; then
      # untracked files git won't copy: env + deps
      cp "$repo_root"/.env* "$wt_path"/ 2>/dev/null
      if [[ -f "$wt_path/package.json" ]]; then
        echo "Installing deps in $wt_path ..."
        if   [[ -f "$wt_path/bun.lock" ]];          then (cd "$wt_path" && bun install)
        elif [[ -f "$wt_path/pnpm-lock.yaml" ]];    then (cd "$wt_path" && pnpm install)
        elif [[ -f "$wt_path/package-lock.json" ]]; then (cd "$wt_path" && npm install)
        fi
      fi
    fi
  fi
  WORK_DIR="$wt_path"
fi

[[ -z "$WS_LABEL" ]] && WS_LABEL="$(basename "$WORK_DIR")"

if [[ -z "$DEV_CMD" ]]; then
  if   [[ -f "$WORK_DIR/bun.lock" ]];        then DEV_CMD="bun dev"
  elif [[ -f "$WORK_DIR/pnpm-lock.yaml" ]];  then DEV_CMD="pnpm dev"
  elif [[ -f "$WORK_DIR/package-lock.json" ]]; then DEV_CMD="npm run dev"
  else DEV_CMD="pnpm dev"
  fi
fi

# ─── Focus if workspace already exists ────────────────────────────────────────
if [[ -z "$ws_id" ]]; then
  ws_id="$(herdr workspace list 2>/dev/null | jq -r --arg l "$WS_LABEL" '.result.workspaces[] | select(.label==$l) | .workspace_id' | head -1)"
fi

if [[ -n "$ws_id" ]]; then
  herdr workspace focus "$ws_id" >/dev/null
  exec herdr
fi

# ─── Build workspace ──────────────────────────────────────────────────────────
created="$(herdr workspace create --cwd "$WORK_DIR" --label "$WS_LABEL" --no-focus)" || exit 1
ws_id="$(jq -r '.result.workspace.workspace_id' <<<"$created")"
tab1="$(jq -r '.result.tab.tab_id' <<<"$created")"
pane1="$(jq -r '.result.root_pane.pane_id' <<<"$created")"

# Tab 1: editor
herdr tab rename "$tab1" editor >/dev/null
herdr pane run "$pane1" "v ." >/dev/null

# Tab 2: dev
# Layout: left 80% = pi agent | right 20% top = dev server, bottom = shell/test
TEST_CMD=""
[[ "$WS_LABEL" == "wick-ui" ]] && DEV_CMD="pnpm dev" && TEST_CMD="pnpm test:ui"

tab2="$(herdr tab create --workspace "$ws_id" --cwd "$WORK_DIR" --label dev --no-focus)"
tab2_pane1="$(jq -r '.result.root_pane.pane_id' <<<"$tab2")"
herdr pane run "$tab2_pane1" "a" >/dev/null
tab2_pane2="$(herdr pane split --pane "$tab2_pane1" --direction right --ratio 0.2 --cwd "$WORK_DIR" --no-focus | jq -r '.result.pane.pane_id')"
herdr pane run "$tab2_pane2" "$DEV_CMD" >/dev/null
tab2_pane3="$(herdr pane split --pane "$tab2_pane2" --direction down --cwd "$WORK_DIR" --no-focus | jq -r '.result.pane.pane_id')"
[[ -n "$TEST_CMD" ]] && herdr pane run "$tab2_pane3" "$TEST_CMD" >/dev/null

# Tab 3: git
tab3="$(herdr tab create --workspace "$ws_id" --cwd "$WORK_DIR" --label git --no-focus)"
tab3_pane1="$(jq -r '.result.root_pane.pane_id' <<<"$tab3")"
herdr pane run "$tab3_pane1" "lazygit" >/dev/null

# Extra windows
idx=1
for cmd in "${EXTRA_WINDOWS[@]}"; do
  win_name="$(echo "$cmd" | awk '{print $NF}' | tr -d ':./')"
  [[ -z "$win_name" ]] && win_name="extra-$idx"
  extra_tab="$(herdr tab create --workspace "$ws_id" --cwd "$WORK_DIR" --label "$win_name" --no-focus)"
  extra_pane="$(jq -r '.result.root_pane.pane_id' <<<"$extra_tab")"
  herdr pane run "$extra_pane" "$cmd" >/dev/null
  ((idx++))
done

# ─── Focus & attach ───────────────────────────────────────────────────────────
herdr workspace focus "$ws_id" >/dev/null
herdr tab focus "$tab1" >/dev/null
exec herdr
