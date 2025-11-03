#!/bin/bash
# if [ "$WEZTERM" != "true" ]; then
#   export WEZTERM=true
#   exec wezterm -e "$0" "$@" &
#   exit 0
# fi
# Set your work directory here
WORK_DIR=$(pwd)
NAME=$(basename "$WORK_DIR")
# Check if "wick" session exists
if tmux has-session -t "$NAME" 2>/dev/null; then
  # If it exists, attach to it
  tmux attach-session -t "$NAME"
else
  # Change to work directory
  cd "$WORK_DIR" || exit 1

  # Determine dev command based on lockfile; default to pnpm
  if [ -f bun.lock ]; then
    DEV_CMD="bun dev"
  elif [ -f pnpm-lock.yaml ]; then
    DEV_CMD="pnpm dev"
  elif [ -f package-lock.json ]; then
    DEV_CMD="npm run dev"
  else
    DEV_CMD="pnpm dev"
  fi

  # Create new session named "wick" with first window
  tmux new-session -d -s "$NAME" -n editor

  # Window 1: nvim with current directory
  tmux send-keys -t "$NAME":editor 'vi .' C-m
  sleep 0.1

  # Window 2: Left - tests, Right - two panes (top: pnpm dev, bottom: focused)
  tmux new-window -t "$NAME" -n dev
  tmux send-keys -t "$NAME":dev 'opencode' C-m
  sleep 0.1

  # Split window into two columns (left 50%, right 50%)
  tmux split-window -h -t "$NAME":dev
  tmux send-keys -t "$NAME":dev.2 "$DEV_CMD" C-m
  sleep 0.1

  # Split the right pane into two (top 50%, bottom 50%)
  tmux split-window -v -t "$NAME":dev.2

  # Select the bottom-right pane as focused
  tmux select-pane -t "$NAME":dev.3

  # Window 3: lazygit
  tmux new-window -t "$NAME" -n git
  tmux send-keys -t "$NAME":git 'lazygit' C-m
  sleep 0.1

  # Select the first window as starting point
  tmux select-window -t "$NAME":editor

  # Attach to the session
  tmux attach-session -t "$NAME"
fi
