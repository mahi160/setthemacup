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

  First, the basics the installer needs:
    1. Xcode Command Line Tools   (git, compilers — a dialog may appear)
    2. This repo                  → ~/.setup
    3. fnm + Node.js LTS + pnpm   (runs the installer)

  Then a checklist of everything else: Homebrew, CLI tools, dotfiles,
  git + SSH, Neovim, AI tools, apps, macOS settings. All selected by default.

  Every detail: $DOCS_URL

EOF
if has_tty; then
  read -r -p "  Press Enter to continue, Ctrl-C to stop. " _ <"$TTY"
  echo
fi

# ─── 2. Xcode Command Line Tools ─────────────────────────────────────────────
if xcode-select -p >/dev/null 2>&1; then
  ok "Xcode Command Line Tools"
else
  step "Installing Xcode Command Line Tools — click Install in the dialog"
  xcode-select --install >/dev/null 2>&1 || true
  until xcode-select -p >/dev/null 2>&1; do sleep 5; done
  ok "Xcode Command Line Tools"
fi

# ─── 3. Repo ─────────────────────────────────────────────────────────────────
if [[ -d "$REPO_DIR/.git" ]]; then
  git -C "$REPO_DIR" pull --ff-only --quiet && ok "Repo updated ($REPO_DIR)" ||
    printf ' ! git pull failed — using the local copy\n'
else
  step "Cloning setthemacup to $REPO_DIR"
  git clone --quiet "$REPO_URL" "$REPO_DIR"
  ok "Repo cloned"
fi
export SETTHEMACUP="$REPO_DIR"

# ─── 4. fnm → Node LTS → pnpm ────────────────────────────────────────────────
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

# ─── 5. Hand off to the installer ────────────────────────────────────────────
(cd "$REPO_DIR" && pnpm install --frozen-lockfile --prod --silent)
ok "Installer ready"
echo

if has_tty; then
  exec node "$REPO_DIR/installer/index.ts" "$@" <"$TTY"
else
  exec node "$REPO_DIR/installer/index.ts" "$@"
fi
