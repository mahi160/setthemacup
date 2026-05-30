#!/usr/bin/env bash
# Quick Q&A with pi (haiku, web-access + claude extension)
# Used by tmux binding M-o

set -euo pipefail

# Run pi with haiku + web-access + claude extension
pi \
  --model gemini-flash-latest
