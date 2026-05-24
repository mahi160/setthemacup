#!/bin/bash

# ─── Usage ────────────────────────────────────────────────────────────────────
# dev [options]
#   --dir  <path>   working directory     (default: cwd)
#   --cmd  <cmd>    dev server command    (default: auto-detect from lockfile)
#   --name <name>   tmux session name     (default: basename of dir)
#   --window <cmd>  extra window + cmd    (repeatable)
#
# Examples:
#   dev
#   dev --dir ~/projects/myapp
#   dev --cmd "bun run start"
#   dev --window "pnpm test" --window "pnpm lint"

# ─── Defaults ─────────────────────────────────────────────────────────────────
WORK_DIR="$(pwd)"
SESSION_NAME=""
DEV_CMD=""
EXTRA_WINDOWS=()

# ─── Parse flags ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)    WORK_DIR="$2";          shift 2 ;;
    --cmd)    DEV_CMD="$2";           shift 2 ;;
    --name)   SESSION_NAME="$2";      shift 2 ;;
    --window) EXTRA_WINDOWS+=("$2");  shift 2 ;;
    *)
      echo "Unknown flag: $1"
      echo "Usage: dev [--dir <path>] [--cmd <cmd>] [--name <name>] [--window <cmd>]..."
      exit 1
      ;;
  esac
done

# ─── Resolve ──────────────────────────────────────────────────────────────────
WORK_DIR="$(cd "$WORK_DIR" 2>/dev/null && pwd)" || {
  echo "Error: directory '$WORK_DIR' not found."
  exit 1
}

[[ -z "$SESSION_NAME" ]] && SESSION_NAME="$(basename "$WORK_DIR")"

if [[ -z "$DEV_CMD" ]]; then
  if   [[ -f "$WORK_DIR/bun.lock" ]];        then DEV_CMD="bun dev"
  elif [[ -f "$WORK_DIR/pnpm-lock.yaml" ]];  then DEV_CMD="pnpm dev"
  elif [[ -f "$WORK_DIR/package-lock.json" ]]; then DEV_CMD="npm run dev"
  else DEV_CMD="pnpm dev"
  fi
fi

# ─── Attach if session exists ─────────────────────────────────────────────────
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux attach-session -t "$SESSION_NAME"
  exit 0
fi

# ─── Build session ────────────────────────────────────────────────────────────
cd "$WORK_DIR" || exit 1

# Window 1: editor
tmux new-session -d -s "$SESSION_NAME" -n editor
tmux send-keys -t "$SESSION_NAME":editor 'v .' C-m

# Window 2: dev
# Layout: left 80% = pi agent | right 20% top = dev server, bottom = shell
tmux new-window -t "$SESSION_NAME" -n dev
tmux send-keys -t "$SESSION_NAME":dev 'a' C-m
sleep 0.1
tmux split-window -h -l 20% -t "$SESSION_NAME":dev
tmux send-keys -t "$SESSION_NAME":dev.2 "$DEV_CMD" C-m
sleep 0.1
tmux split-window -v -t "$SESSION_NAME":dev.2
tmux select-pane -t "$SESSION_NAME":dev.3

# Window 3: git
tmux new-window -t "$SESSION_NAME" -n git
tmux send-keys -t "$SESSION_NAME":git 'lazygit' C-m

# Extra windows
idx=1
for cmd in "${EXTRA_WINDOWS[@]}"; do
  win_name="$(echo "$cmd" | awk '{print $NF}' | tr -d ':./')"
  [[ -z "$win_name" ]] && win_name="extra-$idx"
  tmux new-window -t "$SESSION_NAME" -n "$win_name"
  tmux send-keys -t "$SESSION_NAME":"$win_name" "$cmd" C-m
  ((idx++))
done

# ─── Focus & attach ───────────────────────────────────────────────────────────
tmux select-window -t "$SESSION_NAME":editor
tmux attach-session -t "$SESSION_NAME"
