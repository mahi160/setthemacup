/**
 * Package manifest. Add or remove packages here; the installer, `setup --list`
 * and the docs page all read it. Tap-qualified names (owner/tap/name) are
 * tapped automatically before install.
 */

export type AppKind = 'formula' | 'cask';

export interface App {
  name: string;
  kind: AppKind;
  category: string;
  desc: string;
}

export const apps: App[] = [
  // ── CLI tools ────────────────────────────────────────────────────────────
  { name: 'git', kind: 'formula', category: 'Git', desc: 'Newer git than the one in Xcode CLT' },
  { name: 'gh', kind: 'formula', category: 'Git', desc: 'GitHub CLI — auth, PRs, SSH key upload' },
  { name: 'git-delta', kind: 'formula', category: 'Git', desc: 'Syntax-highlighted diffs (git pager)' },
  { name: 'lazygit', kind: 'formula', category: 'Git', desc: 'Git TUI (`lg`)' },
  { name: 'neovim', kind: 'formula', category: 'Editor', desc: 'Editor, LazyVim config (`v`)' },
  { name: 'tree-sitter-cli', kind: 'formula', category: 'Editor', desc: 'Parser builds for nvim-treesitter' },
  { name: 'ripgrep', kind: 'formula', category: 'Editor', desc: 'Fast grep, used by LazyVim pickers' },
  { name: 'fd', kind: 'formula', category: 'Editor', desc: 'Fast find, used by LazyVim pickers' },
  { name: 'tmux', kind: 'formula', category: 'Terminal', desc: 'Terminal multiplexer (no plugins)' },
  { name: 'fzf', kind: 'formula', category: 'Terminal', desc: 'Fuzzy finder — Ctrl-R history, Ctrl-T files' },
  { name: 'stow', kind: 'formula', category: 'Terminal', desc: 'Links dotfiles into $HOME' },
  { name: 'fastfetch', kind: 'formula', category: 'Terminal', desc: 'System info' },
  { name: 'onefetch', kind: 'formula', category: 'Terminal', desc: 'Repo info (`of`)' },
  { name: 'nowplaying-cli', kind: 'formula', category: 'Terminal', desc: 'Now-playing widget in the tmux status bar' },
  { name: 'lazydocker', kind: 'formula', category: 'Dev', desc: 'Docker TUI (`ld`)' },
  { name: 'lazysql', kind: 'formula', category: 'Dev', desc: 'SQL TUI — MySQL, PostgreSQL, SQLite, MSSQL' },
  { name: 'terminal-notifier', kind: 'formula', category: 'System', desc: 'Notifications from pi' },
  { name: 'mole', kind: 'formula', category: 'System', desc: 'Disk analyzer + app uninstaller (`mo analyze`, `mo uninstall`) — run by hand' },
  { name: 'openfortivpn', kind: 'formula', category: 'System', desc: 'FortiGate VPN with SAML/SSO (`vpn`)' },

  // ── GUI apps ─────────────────────────────────────────────────────────────
  { name: 'ghostty', kind: 'cask', category: 'Terminal', desc: 'Terminal' },
  { name: 'brave-browser', kind: 'cask', category: 'Browser', desc: 'Browser' },
  { name: 'abue-ammar/tinycast/tinycast', kind: 'cask', category: 'Productivity', desc: 'Launcher — clipboard history, window management, snippets' },
  { name: 'obsidian', kind: 'cask', category: 'Productivity', desc: 'Notes' },
  { name: 'alt-tab', kind: 'cask', category: 'Productivity', desc: 'Windows-style app switcher with previews' },
  { name: 'shottr', kind: 'cask', category: 'Productivity', desc: 'Screenshots with annotation and OCR' },
  { name: 'slack', kind: 'cask', category: 'Chat', desc: 'Work chat' },
  { name: 'whatsapp', kind: 'cask', category: 'Chat', desc: 'Messaging' },
  { name: 'telegram', kind: 'cask', category: 'Chat', desc: 'Messaging' },
  { name: 'localsend', kind: 'cask', category: 'Utilities', desc: 'AirDrop-style file sharing with any device' },
  { name: 'mos', kind: 'cask', category: 'Utilities', desc: 'Smooth scrolling for mice' },
  { name: 'doll', kind: 'cask', category: 'Utilities', desc: 'Menu bar notification badges' },
  { name: 'stats', kind: 'cask', category: 'Utilities', desc: 'CPU / memory / network in the menu bar' },
  { name: 'tailscale-app', kind: 'cask', category: 'Network', desc: 'Tailscale VPN (menu bar app)' },
  { name: 'orbstack', kind: 'cask', category: 'Dev', desc: 'Docker and Linux VMs' },
  { name: 'iina', kind: 'cask', category: 'Media', desc: 'Video player' },
  { name: 'transmission', kind: 'cask', category: 'Media', desc: 'Torrent client' },
  { name: 'mahi160/tbis/tbis', kind: 'cask', category: 'Media', desc: 'tbis — my app' },
  { name: 'font-cascadia-code-nf', kind: 'cask', category: 'Fonts', desc: 'Cascadia Code Nerd Font (Ghostty)' },
  { name: 'font-jetbrains-mono-nerd-font', kind: 'cask', category: 'Fonts', desc: 'JetBrains Mono Nerd Font' },
];

export const names = (kind: AppKind) => apps.filter((a) => a.kind === kind).map((a) => a.name);

/** owner/tap of every tap-qualified package */
export const taps = (kind: AppKind) =>
  [...new Set(apps.filter((a) => a.kind === kind && a.name.split('/').length === 3).map((a) => a.name.split('/').slice(0, 2).join('/')))];
