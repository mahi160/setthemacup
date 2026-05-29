#!/usr/bin/env bash
# 10-ssh.sh — Generate SSH keys, configure ~/.ssh/config, add to agent.

[[ -z "${SETUP_LIB_LOADED:-}" ]] && source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

set_ssh() {
  (set -euo pipefail
  step "SSH"

  mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"

  local ssh_keys=("id_ed25519:omarsifat288@gmail.com" "qp_ed25519:salauddin.sifat@questionpro.com")

  # Generate missing keys
  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename comment <<< "$key"
    if [[ ! -f "$HOME/.ssh/$filename" ]]; then
      ssh-keygen -t ed25519 -C "$comment" -f "$HOME/.ssh/$filename" -N "" \
        || { warn "Failed to generate $filename."; log "Failed to generate SSH key $filename"; }
      success "Generated $filename."
    else
      success "SSH key $filename already exists."
    fi
  done

  # Merge host entries — never overwrite existing ones
  local config="$HOME/.ssh/config"; touch "$config"; chmod 600 "$config"

  if ! grep -q "Host github.com" "$config" 2>/dev/null; then
    cat >> "$config" <<'EOF'

Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
EOF
    success "Added github.com to SSH config."
  else
    success "github.com already in SSH config."
  fi

  if ! grep -q "Host qp.github.com" "$config" 2>/dev/null; then
    cat >> "$config" <<'EOF'

Host qp.github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/qp_ed25519
EOF
    success "Added qp.github.com to SSH config."
  else
    success "qp.github.com already in SSH config."
  fi

  # Add keys to agent
  eval "$(ssh-agent -s)" >/dev/null
  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename _ <<< "$key"
    if [[ -f "$HOME/.ssh/$filename" ]]; then
      ssh-add --apple-use-keychain "$HOME/.ssh/$filename" 2>/dev/null \
        || ssh-add "$HOME/.ssh/$filename" 2>/dev/null \
        || warn "Could not add $filename to agent."
    fi
  done

  # Print public keys for GitHub
  echo ""
  info "Add these public keys to GitHub:"
  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename comment <<< "$key"
    if [[ -f "$HOME/.ssh/$filename.pub" ]]; then
      echo -e "  ${YELLOW}[$comment]${RESET}"
      echo "  $(cat "$HOME/.ssh/$filename.pub")"
      echo ""
    fi
  done

  success "SSH setup complete."; log "SSH setup complete"
  )
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && { source "$(cd "$(dirname "$0")" && pwd)/lib.sh"; set_ssh; }
