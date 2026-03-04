---
description: Review code for quality, security, and best practices
agent: build
model: github-copilot/claude-sonnet-4.5
---

Perform a comprehensive code review of the current changes or specified files. Focus on:

1. **Security vulnerabilities**: Check for exposed secrets, SQL injection, XSS, CSRF, insecure dependencies
2. **Performance issues**: Identify inefficient algorithms, unnecessary re-renders, memory leaks, blocking operations
3. **Code quality**: Review code structure, readability, maintainability, proper error handling
4. **Best practices**: Verify TypeScript types, React patterns, proper async/await usage, test coverage
5. **Architecture**: Check for proper separation of concerns, DRY principle, SOLID principles

Provide specific, actionable feedback with file paths and line numbers. Suggest concrete improvements with code examples when relevant.
