---
description: Generate comprehensive tests for code
agent: build
model: github-copilot/claude-sonnet-4.5
---

Generate comprehensive test coverage for the specified code or current changes. Include:

1. **Unit tests**: Test individual functions/methods in isolation with proper mocking
2. **Integration tests**: Test component interactions and data flow
3. **Edge cases**: Cover boundary conditions, empty/null/undefined inputs, error scenarios
4. **Happy path**: Test normal, expected behavior
5. **Error handling**: Verify proper error messages and error state handling
6. **Async operations**: Test promises, async/await, loading states, timeouts

Use appropriate testing framework (Jest, Vitest, React Testing Library). Write descriptive test names that clearly explain what is being tested. Follow AAA pattern (Arrange, Act, Assert).
