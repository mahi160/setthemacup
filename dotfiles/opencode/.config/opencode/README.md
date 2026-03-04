# OpenCode Configuration

This directory contains a comprehensive OpenCode configuration optimized for eye-comfort themed development and productivity.

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

### Core Configuration

- **`opencode.jsonc`** - Main OpenCode configuration
  - Model settings (Claude Sonnet 4.5 main, Haiku 4.5 small)
  - Auto-update preferences (notify mode)
  - Default agent (build)
  - Context compaction (15000 reserved tokens)
  - File watcher ignore patterns
  - Formatter configurations (Prettier, Stylua)
  - Permission settings
  - Custom instructions
  - MCP server configuration

- **`tui.json`** - TUI-specific settings
  - Theme configuration
  - Keybindings
  - UI preferences

- **`AGENTS.md`** - Global agent instructions
  - Communication style
  - Code quality standards (TypeScript, React, error handling)
  - Testing philosophy
  - Git commit conventions
  - Workflow preferences
  - Security best practices

### Custom Commands

Located in `command/` directory. Use with `/command-name`:

- **`/commit`** - Create proper conventional commits
- **`/review`** - Comprehensive code review (security, performance, best practices)
- **`/refactor`** - Refactor code for quality and maintainability
- **`/test`** - Generate comprehensive test coverage
- **`/docs`** - Generate API documentation and usage examples
- **`/fix`** - Fix bugs with root cause analysis
- **`/ghostty`** - Help with Ghostty terminal configuration
- **`/neovim`** - Help with Neovim configuration
- **`/nvim-plug`** - Manage Neovim plugins
- **`/optimize`** - Optimize code performance
- **`/tmux`** - Help with tmux configuration

### Skills

Located in `skills/` directory:

- **`react-doctor`** - Run after React changes to catch issues early
- **`web-design-guidelines`** - Review UI for accessibility and best practices
- **`vercel-react-best-practices`** - React/Next.js performance optimization

## Configuration Highlights

### Model Configuration
- **Main model**: Claude Sonnet 4.5 for complex reasoning and code generation
- **Small model**: Claude Haiku 4.5 for quick tasks and responses

### File Watcher
Ignores common build artifacts and dependencies:
- `node_modules/`, `dist/`, `build/`, `.next/`, `.nuxt/`
- `coverage/`, `.git/`, `*.log`, `.cache/`
- Lock files: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`

### Formatters
- **JavaScript/TypeScript/JSON/Markdown**: Prettier
- **Lua**: Stylua

### Permissions
- **Bash**: Ask before execution (safety)
- **Edit**: Allow (trust file modifications)
- **Write**: Ask before creating files (prevent clutter)

## Learn More

- [OpenCode Themes Documentation](https://opencode.ai/docs/themes)
- [Theme Configuration](https://opencode.ai/docs/config)
