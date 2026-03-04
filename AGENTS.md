# setthemacup Project Instructions

Project-specific instructions for the setthemacup dotfiles repository.

## Project Overview

This is a personal dotfiles repository managed with GNU Stow, focusing on eye-comfort themed development environments with Neovim, Ghostty terminal, and OpenCode configurations.

## Project Structure

```
setthemacup/
├── dotfiles/
│   ├── nvim/.config/nvim.minimal/      # Minimal Neovim config
│   ├── ghostty/.config/ghostty/        # Ghostty terminal config
│   ├── opencode/.config/opencode/      # OpenCode config
│   └── [other-apps]/                   # Other application configs
├── scripts/                             # Setup and utility scripts
└── README.md                            # Project documentation
```

## Important Paths

- **Neovim config**: `dotfiles/nvim/.config/nvim.minimal/`
- **Ghostty config**: `dotfiles/ghostty/.config/ghostty/`
- **OpenCode config**: `dotfiles/opencode/.config/opencode/`
- **Stow target**: `~/.config/` (after stowing)

## Conventions

### GNU Stow Structure

- All dotfiles organized by application in `dotfiles/{app}/`
- Directory structure mirrors target home directory structure
- Use `stow -d dotfiles -t ~ {app}` to deploy
- Always maintain correct paths relative to stow structure

### File Modifications

- Test configurations before committing
- Document major changes in relevant AGENTS.md files
- Keep configs minimal and focused
- Prefer native features over external dependencies

### Theme Configuration

**Current theme**: Everforest (soft variant for eye comfort)

- **Neovim**: Everforest soft (sainnhe/everforest plugin)
- **Ghostty**: Everforest Dark Hard (built-in theme)
- **OpenCode**: Everforest (built-in theme in tui.json)

**Alternative themes available**:
- Kanagawa (wave/dragon variants)
- Gruvbox Material (maintained as fallback)

### Neovim-Specific Rules

- Follow minimal config philosophy
- Use native Neovim APIs when possible
- Keep plugin count low (currently using lazy.nvim)
- Full italic support enabled for all themes
- Document theme configurations in `lua/extras/colorscheme.lua`

### OpenCode Configuration

- Global config: `dotfiles/opencode/.config/opencode/opencode.jsonc`
- TUI settings: `dotfiles/opencode/.config/opencode/tui.json`
- Custom commands: `dotfiles/opencode/.config/opencode/command/*.md`
- Skills: `dotfiles/opencode/.config/opencode/skills/`
- Agent instructions: `dotfiles/opencode/.config/opencode/AGENTS.md`

### Commit Guidelines

- Test configs work after changes (especially Neovim)
- Create backups before major modifications
- Use conventional commits (feat/fix/docs/refactor)
- Document breaking changes in commit messages

## Key Files

### Configuration Files

- `dotfiles/nvim/.config/nvim.minimal/init.lua` - Neovim entry point
- `dotfiles/nvim/.config/nvim.minimal/lua/extras/colorscheme.lua` - Theme config
- `dotfiles/ghostty/.config/ghostty/config` - Ghostty terminal config
- `dotfiles/opencode/.config/opencode/opencode.jsonc` - OpenCode main config
- `dotfiles/opencode/.config/opencode/tui.json` - OpenCode UI theme

### Documentation Files

- `dotfiles/nvim/.config/nvim.minimal/AGENTS.md` - Neovim-specific rules
- `dotfiles/opencode/.config/opencode/AGENTS.md` - OpenCode global rules
- `dotfiles/opencode/.config/opencode/README.md` - OpenCode theme documentation

## Development Workflow

1. **Making changes**:
   - Edit files in `dotfiles/{app}/.config/`
   - Test changes before committing
   - Update documentation if needed

2. **Testing changes**:
   - Neovim: Open nvim and check for errors, verify theme loads
   - Ghostty: Restart terminal and verify theme applied
   - OpenCode: Restart OpenCode and check settings loaded

3. **Deploying changes**:
   - Use GNU Stow to symlink configs to home directory
   - `cd setthemacup && stow -d dotfiles -t ~ nvim ghostty opencode`

4. **Version control**:
   - Commit tested changes with descriptive messages
   - Keep commits atomic and focused
   - Reference issue numbers if applicable

## Common Tasks

### Adding a new theme

1. Update `dotfiles/nvim/.config/nvim.minimal/lua/extras/colorscheme.lua`
2. Update `dotfiles/ghostty/.config/ghostty/config`
3. Update `dotfiles/opencode/.config/opencode/tui.json`
4. Update theme documentation in READMEs
5. Test all configs work correctly

### Adding a new OpenCode command

1. Create `dotfiles/opencode/.config/opencode/command/{name}.md`
2. Follow existing command format (see commit.md, review.md)
3. Test command works with `/command-name`
4. Update README.md if significant

### Modifying Neovim config

1. Edit relevant file in `dotfiles/nvim/.config/nvim.minimal/`
2. Test by opening Neovim and checking for errors
3. Verify plugins load correctly
4. Update AGENTS.md if conventions change
5. Create backup if making significant changes

## Notes

- Eye comfort is priority - choose soft/warm themes
- Keep configs minimal and maintainable
- Document complex configurations
- Test before committing
- Use GNU Stow for deployment
