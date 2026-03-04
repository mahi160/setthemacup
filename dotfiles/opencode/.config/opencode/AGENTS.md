# Global Agent Instructions

These instructions apply to all OpenCode agents across all projects.

## Communication Style

- Be concise and direct
- Avoid unnecessary verbosity or superlatives
- Focus on technical accuracy over enthusiasm
- No emojis unless explicitly requested
- Provide actionable information

## Code Quality Standards

### TypeScript & JavaScript

- Use TypeScript for all new code
- Prefer functional programming patterns
- Use modern ES6+ syntax
- Avoid `any` types - use `unknown` or proper types
- Prefer `const` over `let`, never use `var`
- Use async/await over raw promises
- Handle errors explicitly - no silent failures
- Use descriptive variable names (no single letters except loops)

### React

- Functional components only (no class components)
- Use hooks appropriately (useState, useEffect, useMemo, useCallback)
- Extract complex logic into custom hooks
- Keep components small and focused (single responsibility)
- Prefer composition over prop drilling
- Use React.memo() for expensive components
- Handle loading and error states explicitly

### Error Handling

- Always wrap async operations in try-catch
- Provide meaningful error messages
- Log errors with context
- Handle edge cases explicitly
- Fail fast and loud - no silent failures

### Performance

- Avoid premature optimization
- Profile before optimizing
- Use proper data structures (Map/Set vs Object/Array)
- Memoize expensive calculations
- Lazy load when appropriate
- Minimize bundle size

## Testing Philosophy

- Write tests for critical paths
- Focus on behavior, not implementation
- Keep tests simple and readable
- Use descriptive test names
- Mock external dependencies
- Test edge cases and error conditions

## Git Commit Conventions

- Use conventional commits format: `type(scope): message`
- Types: feat, fix, refactor, docs, test, chore, style
- Keep commits atomic and focused
- Write clear, descriptive commit messages
- Reference issue numbers when applicable

## Neovim Integration

- Respect minimal config philosophy
- Use native Neovim APIs where possible
- Prefer built-in features over plugins
- Keep configuration simple and maintainable
- Document complex configurations
- Test changes before committing

## Workflow Preferences

- Always check existing code before adding new code
- Reuse existing patterns and utilities
- Update documentation when changing behavior
- Run tests before committing
- Fix linting/formatting issues immediately
- Ask before making major architectural changes

## Documentation

- Code should be self-documenting when possible
- Add comments for complex logic or non-obvious decisions
- Keep README files up to date
- Document APIs and public interfaces
- Include usage examples for utilities

## Security

- Never commit secrets or credentials
- Use environment variables for sensitive data
- Validate all user input
- Sanitize data before display
- Use secure dependencies (check for vulnerabilities)
- Follow principle of least privilege

## Dependencies

- Minimize external dependencies
- Prefer well-maintained packages
- Check bundle size impact
- Keep dependencies up to date
- Document why dependencies are needed
- Remove unused dependencies

## OpenCode Configuration

When modifying `opencode.jsonc`, always refer to the official schema: https://opencode.ai/config.json

### Correct Field Names

- ✅ `model` and `small_model` (NOT `models` object)
- ✅ `permission` (singular, NOT `permissions` plural)
- ✅ `formatter` (singular, NOT `formatters` plural)
- ✅ `instructions` (array of paths)
- ✅ `default_agent` (NOT `defaultAgent`)

### Permission Syntax

Permissions use simple string values, not nested objects:

```jsonc
"permission": {
  "bash": "ask",      // ask, allow, or deny
  "edit": "allow",
  "write": "ask"
}
```

### Formatter Syntax

Formatters use the singular `formatter` key with proper structure:

```jsonc
"formatter": {
  "prettier": {
    "extensions": [".js", ".ts", ".json"],
    "command": ["prettier", "--write", "$FILE"]
  },
  "stylua": {
    "extensions": [".lua"],
    "command": ["stylua", "$FILE"]
  }
}
```

### Common Mistakes to Avoid

1. **DO NOT** use `models: { main: "...", small: "..." }` - Use `model` and `small_model` directly
2. **DO NOT** use `permissions` (plural) - Use `permission` (singular)
3. **DO NOT** use `formatters` (plural) - Use `formatter` (singular)
4. **DO NOT** use camelCase for keys like `defaultAgent` - Use snake_case like `default_agent`
5. **DO NOT** nest permission values - Use simple strings: `"bash": "ask"`

