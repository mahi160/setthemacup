#!/usr/bin/env bash
# bootstrap.sh — fresh Mac to a fully set-up dev machine.
#
#   curl -fsSL https://raw.githubusercontent.com/mahi160/setthemacup/main/bootstrap.sh | bash
#
# Installs only what the installer needs (Xcode CLT, this repo, fnm, Node LTS,
# pnpm), then hands off to the Node installer, which shows a checklist.
# Safe to re-run: everything already present is skipped.
# Arguments are passed through: `bash bootstrap.sh --dry-run`.

set -euo pipefail

REPO_URL="https://github.com/mahi160/setthemacup.git"
REPO_DIR="$HOME/.setup"
DOCS_URL="https://mahi160.github.io/setthemacup/"
PNPM_VERSION="12.14.0"
FNM_DIR="$HOME/.local/share/fnm"

# stdin is this script when piped from curl; prompts must read the keyboard
TTY=/dev/tty
has_tty() { (: <"$TTY") 2>/dev/null; }

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { printf '\033[34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m ✓\033[0m %s\n' "$*"; }
die()  { printf '\033[31m ✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == Darwin ]] || die "macOS only."

# ─── 1. Tell the user what's about to happen ─────────────────────────────────
cat <<EOF

$(bold "  setthemacup — Mac dev environment")

  You answer a few questions in the first minutes, then it runs on its own:
    1. Your Mac password, once (kept only for this run)
    2. A checklist of what to set up (everything is selected)
    3. GitHub login in the browser, SSH key passphrases
  Then: Xcode tools, Homebrew, CLI tools, dotfiles, git + SSH, Neovim,
  AI skills, apps and macOS settings, with no more input.

  Every detail: $DOCS_URL

EOF
if has_tty; then
  read -r -p "  Press Enter to continue, Ctrl-C to stop. " _ <"$TTY"
  echo
fi

# ─── 2. Password, once ───────────────────────────────────────────────────────
# Kept in a 0600 file in a private temp folder for this run only; the installer reuses
# it for every sudo prompt (via installer/src/lib/askpass) and deletes it when it ends.
if has_tty; then
  secret_dir="$(mktemp -d)"; chmod 700 "$secret_dir"
  trap 'rm -rf "$secret_dir"' EXIT
  for _ in 1 2 3; do
    read -r -s -p "  Your Mac password: " pw <"$TTY"; echo
    sudo -k
    if printf '%s\n' "$pw" | sudo -S -v 2>/dev/null; then
      (umask 077; printf '%s\n' "$pw" >"$secret_dir/sudo")
      export SETTHEMACUP_SECRET_FILE="$secret_dir/sudo"
      break
    fi
    printf '  That password did not work.\n'
  done
  unset pw
  [[ -n "${SETTHEMACUP_SECRET_FILE:-}" ]] || die "Could not verify your password."
fi

# ─── 3. Xcode Command Line Tools (no dialog) ─────────────────────────────────
if xcode-select -p >/dev/null 2>&1; then
  ok "Xcode Command Line Tools"
else
  step "Installing Xcode Command Line Tools (a few minutes)"
  # Same trick Homebrew's installer uses: make softwareupdate list the CLT package
  marker=/tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress
  touch "$marker"
  label="$(softwareupdate -l 2>/dev/null | grep -E '^[[:space:]]*\* Label: Command Line Tools' | sed 's/^.*Label: //' | sort -V | tail -1)"
  if [[ -n "$label" ]]; then
    sudo softwareupdate -i "$label" >/dev/null
  fi
  rm -f "$marker"
  if ! xcode-select -p >/dev/null 2>&1; then
    # Fallback: Apple's dialog
    step "Click Install in the dialog that appears"
    xcode-select --install >/dev/null 2>&1 || true
    until xcode-select -p >/dev/null 2>&1; do sleep 5; done
  fi
  ok "Xcode Command Line Tools"
fi

# ─── 4. Repo ─────────────────────────────────────────────────────────────────
if [[ -d "$REPO_DIR/.git" ]]; then
  git -C "$REPO_DIR" pull --ff-only --quiet && ok "Repo updated ($REPO_DIR)" ||
    printf ' ! git pull failed — using the local copy\n'
else
  step "Cloning setthemacup to $REPO_DIR"
  git clone --quiet "$REPO_URL" "$REPO_DIR"
  ok "Repo cloned"
fi
export SETTHEMACUP="$REPO_DIR"

# ─── 5. fnm → Node LTS → pnpm ────────────────────────────────────────────────
export PATH="$FNM_DIR:$PATH"
if ! command -v fnm >/dev/null 2>&1; then
  step "Installing fnm"
  # --force-install: download the binary even if Homebrew exists (fnm is not a brew package here)
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "$FNM_DIR" --skip-shell --force-install >/dev/null
fi
ok "fnm $(fnm --version | awk '{print $2}')"

eval "$(fnm env --shell bash)"
# Only pick a Node when there is no default yet — never rewrite an existing one
if ! fnm ls 2>/dev/null | grep -q default; then
  lts="$(fnm ls-remote --lts | tail -1 | awk '{print $1}')"
  step "Installing Node.js $lts (LTS)"
  fnm install "$lts" >/dev/null
  fnm default "$lts"
fi
fnm use default >/dev/null
ok "Node $(node -v)"

export PNPM_HOME="$HOME/Library/pnpm"
export PATH="$PNPM_HOME/bin:$PATH"
if [[ "$(pnpm -v 2>/dev/null)" != "$PNPM_VERSION" ]]; then
  step "Installing pnpm $PNPM_VERSION"
  npm install --global --silent "pnpm@$PNPM_VERSION"
fi
ok "pnpm $(pnpm -v)"

# ─── 6. Hand off to the installer ────────────────────────────────────────────
(cd "$REPO_DIR/installer" && pnpm install --frozen-lockfile --prod --silent)
ok "Installer ready"
echo

# exec replaces this shell, so the EXIT trap won't run: the installer takes over the
# password folder and deletes it when it finishes
trap - EXIT
if has_tty; then
  exec node "$REPO_DIR/installer/src/index.ts" "$@" <"$TTY"
else
  exec node "$REPO_DIR/installer/src/index.ts" "$@"
fi
