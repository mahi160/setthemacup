# OpenCode Theme Configuration

This directory contains the OpenCode configuration for the project.

## Current Theme

The current theme is set to **Everforest** for optimal eye comfort and code readability.

## Available Eye-Comfort Themes

OpenCode has built-in support for several eye-comfort focused themes:

### Everforest (Current Default)
- **Design**: Explicitly designed for eye protection with soft contrast
- **Colors**: Warm green tones
- **Best For**: Long coding sessions, works well with redshift/f.lux
- **Usage**: `"theme": "everforest"` in `tui.json`

### Kanagawa
- **Design**: WCAG 2.1 Level AA certified (4.5:1 contrast ratio)
- **Colors**: Inspired by the famous Japanese painting
- **Best For**: Accessibility, professional development
- **Usage**: `"theme": "kanagawa"` in `tui.json`

### Other Available Themes
- `tokyonight` - Modern, balanced theme
- `gruvbox` - Warm retro groove colors
- `catppuccin` - Soothing pastel theme
- `catppuccin-macchiato` - Darker variant
- `nord` - Arctic, north-bluish theme
- `ayu` - Simple, bright theme
- `one-dark` - Atom's iconic theme
- `system` - Adapts to terminal colors

## Switching Themes

### Method 1: Using the TUI Command
While in OpenCode, run:
```
/theme
```
This will bring up a theme selector.

### Method 2: Edit Configuration
Edit `tui.json` in this directory:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "kanagawa"
}
```

Available theme options:
- `"everforest"` - Eye-comfort focused (current default)
- `"kanagawa"` - WCAG AA certified
- `"gruvbox"` - Warm retro colors
- `"tokyonight"` - Modern balanced
- `"system"` - Match terminal colors

## Configuration Files

- `opencode.jsonc` - Main OpenCode configuration (providers, MCP servers)
- `tui.json` - TUI-specific settings (theme, keybinds)

## Learn More

- [OpenCode Themes Documentation](https://opencode.ai/docs/themes)
- [Theme Configuration](https://opencode.ai/docs/config)
