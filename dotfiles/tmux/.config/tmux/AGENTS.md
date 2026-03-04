# Tmux Configuration Instructions

Agent instructions for managing and modifying tmux configuration in setthemacup.

## Configuration Philosophy

This tmux configuration prioritizes:
- **Eye comfort**: Soft, warm color schemes (Everforest default)
- **Vi-style workflow**: Familiar keybindings for Vim users
- **Performance**: Fast response times, especially for Neovim
- **Minimalism**: Essential features without bloat
- **Consistency**: Matches Neovim and Ghostty theming

## File Location

- **Config file**: `dotfiles/tmux/.config/tmux/tmux.conf`
- **After stowing**: `~/.config/tmux/tmux.conf`

## Key Design Decisions

### Prefix Key
- **Primary**: `C-a` (Ctrl+a) - More ergonomic than default `C-b`
- **Secondary**: None (disabled to avoid conflicts)

### Color Themes
Three eye-comfort themes available with easy switching:
1. **Everforest** (default) - Soft green tones, matches Neovim/Ghostty
2. **Kanagawa** (alternative) - Japanese-inspired, WCAG AA certified
3. **Gruvbox Material** (alternative) - Warm retro colors

To switch themes, uncomment desired color variables in the THEME CONFIGURATION section.

### Keybinding Philosophy
- **Vi-style navigation**: `hjkl` for pane movement, `HJKL` for resizing
- **Intuitive splits**: `-` for horizontal, `\` for vertical
- **Path preservation**: New panes/windows open in current directory
- **Quick access**: Most common operations within 2 keystrokes

### Performance Optimizations
- `escape-time 0` - Critical for Neovim responsiveness
- `focus-events on` - Neovim auto-reload support
- Large scrollback buffer (50000 lines)
- Conditional repainting for efficiency

### Plugin Strategy
Using TPM (Tmux Plugin Manager) with carefully selected plugins:
- **tmux-sensible**: Sane defaults
- **tmux-cpu**: CPU usage in status bar
- **tmux-battery**: Battery status for laptops
- **tmux-resurrect**: Manual session save/restore
- **tmux-continuum**: Automatic session persistence
- **tmux-yank**: Better clipboard integration
- **tmux-nowplaying**: Display current music/media

## Modification Guidelines

### When Changing Keybindings

1. **Check for conflicts**: Ensure new binding doesn't override important defaults
2. **Document in quick reference**: Update the header comment section
3. **Follow vi conventions**: Use `hjkl` patterns where possible
4. **Test thoroughly**: Verify binding works in nested sessions

### When Adding Plugins

1. **Evaluate necessity**: Does this solve a real problem?
2. **Check maintenance**: Is the plugin actively maintained?
3. **Test compatibility**: Does it work with current plugins?
4. **Configure properly**: Add plugin settings in TPM PLUGINS section
5. **Update status bar**: If plugin provides status info, integrate it

### When Changing Themes

1. **Maintain eye-comfort**: Choose warm, low-contrast colors
2. **Test readability**: Ensure text is legible in all contexts
3. **Update all tools**: Keep Neovim, Ghostty, tmux in sync
4. **Document changes**: Update theme comments

### When Modifying Status Bar

Current layout:
```
Left: [Session] [Now Playing]
Right: [Battery] | [CPU] | [Command] | [Time Date]
```

Guidelines:
- Keep essential info only (avoid clutter)
- Use color variables (#{@thm_*}) not hardcoded colors
- Test with long session names
- Ensure icons render correctly (Nerd Font required)

## Common Tasks

### Testing Configuration Changes

```bash
# Reload config in running tmux session
tmux source-file ~/.config/tmux/tmux.conf

# Or use the keybinding
C-a r
```

### Switching Themes

1. Open `tmux.conf`
2. Comment out current theme section
3. Uncomment desired theme section
4. Reload config: `C-a r`

### Installing New Plugins

1. Add plugin to TPM PLUGINS section: `set -g @plugin 'user/plugin'`
2. Reload config: `C-a r`
3. Install plugins: `C-a I` (capital I)

### Removing Plugins

1. Remove plugin line from TPM PLUGINS section
2. Reload config: `C-a r`
3. Uninstall plugin: `C-a M-u` (Alt+u)

### Session Management

```bash
# Create new session
tmux new-session -s session-name

# Attach to session
tmux attach -t session-name

# List sessions
tmux ls

# Kill session (from inside)
C-a @
```

## Troubleshooting

### Colors Look Wrong

1. Check terminal true color support: `echo $TERM`
2. Should be `xterm-256color`, `screen-256color`, or similar
3. Verify terminal overrides in config
4. Test in different terminal emulators

### Neovim Escape Delay

Ensure `escape-time 0` is set. If still slow:
1. Check nested tmux sessions (compounds delay)
2. Verify Neovim configuration
3. Test outside tmux to isolate issue

### Plugins Not Loading

1. Ensure TPM is installed: `~/.config/tmux/plugins/tpm/`
2. Install TPM if missing: `git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/plugins/tpm`
3. Reload config and install plugins: `C-a r` then `C-a I`

### Status Bar Not Updating

1. Check `status-interval` setting (default: 5 seconds)
2. Verify plugin scripts are executable
3. Check for errors: `tmux show-messages`

## Integration with Other Tools

### Neovim Integration

- Focus events enabled for auto-reload
- Fast escape time for normal mode
- Same color theme for consistency
- Resurrect saves Neovim sessions

### Ghostty Terminal

- True color support configured
- Matches Everforest theme
- Clipboard integration for macOS
- Font ligatures work in tmux

### macOS Integration

- `pbcopy`/`pbpaste` clipboard support
- System clipboard in vi copy mode
- Option key as Alt (for keybindings)
- Works with Ghostty's quick terminal toggle

## Best Practices

1. **Test before committing**: Reload config and verify everything works
2. **Keep comments updated**: Document why, not just what
3. **Backup before major changes**: Copy config before experimenting
4. **Follow conventions**: Match existing style and patterns
5. **Minimize plugins**: Only add if genuinely useful
6. **Check performance**: Ensure status bar updates don't lag

## References

- [Tmux Manual](https://man.openbsd.org/tmux.1)
- [TPM Documentation](https://github.com/tmux-plugins/tpm)
- [Tmux Cheat Sheet](https://tmuxcheatsheet.com/)
