/**
 * Keybinds shown on the docs page. Hand-kept: update alongside tmux.conf,
 * the Ghostty config, .zshrc and nvim keymaps.
 */

export interface Keybind {
  keys: string;
  action: string;
}

export const keybinds: Record<string, Keybind[]> = {
  'tmux (prefix C-a)': [
    { keys: 'C-a r', action: 'Reload config' },
    { keys: 'C-a - / C-a \\', action: 'Split below / right (same directory)' },
    { keys: 'C-a h j k l', action: 'Move between panes' },
    { keys: 'C-a H J K L', action: 'Resize pane (repeatable)' },
    { keys: 'C-a c', action: 'New window (same directory)' },
    { keys: 'C-a n / p / Tab', action: 'Next / previous / last window' },
    { keys: 'C-a < / >', action: 'Move window left / right' },
    { keys: 'C-a v', action: 'Copy mode (v select, y copy to clipboard)' },
    { keys: 'C-a m', action: 'Toggle mouse' },
    { keys: 'C-a S / N / @', action: 'Choose / new / kill session' },
    { keys: 'Alt-p', action: 'Popup shell in the current directory' },
    { keys: 'Alt-o', action: 'Ask pi a quick question (popup)' },
    { keys: 'Alt-n / Alt-l', action: 'Quick note / quick learning (popup)' },
  ],
  Ghostty: [
    { keys: '⌘`', action: 'Quick terminal (global)' },
    { keys: '⌘⇧,', action: 'Reload config' },
  ],
  zsh: [
    { keys: 'Ctrl-R', action: 'Fuzzy history (fzf)' },
    { keys: 'Ctrl-T / Alt-C', action: 'Fuzzy file / cd (fzf)' },
    { keys: 'Esc Esc', action: 'Prefix the command with sudo' },
    { keys: 'Alt-Q', action: 'New Pokemon background' },
    { keys: 'z <dir>', action: 'Jump to a frequent directory' },
  ],
  'Neovim (LazyVim)': [
    { keys: '-', action: 'Open the parent directory (oil)' },
    { keys: 'Shift-J', action: 'Last buffer' },
    { keys: 'Space Space', action: 'Find files' },
  ],
  macOS: [
    { keys: '⌘Space', action: 'Tinycast' },
    { keys: 'Caps Lock', action: 'Control' },
    { keys: 'fn ⌃ ←/→', action: 'Tile window left / right (built in)' },
  ],
};
