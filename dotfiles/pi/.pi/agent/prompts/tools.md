---
description: Show all available tools and when to use them
---

## 📋 All Available Tools

### File & Code Operations
- **Read** — view file contents (text/images)
- **Write** — create/overwrite files
- **Edit** — surgical text replacements (exact matching, multiple edits in one call)
- **Bash** — execute commands (ls, grep, find, sed, etc.)

### Code Analysis (Subagents)
- **scout** — map repo structure, find symbols, trace code flow (cheap, read-only)
- **review** — check edits for correctness/regressions/edge cases (auto-call after edits)
- **tests** — identify missing high-risk tests (auto-call after behavior changes)
- **security** — scan for exploitable auth/input/file/network/secrets issues (auto-call for sensitive code)

### Web Research
- **mcp__webaccess__web_search** — multi-query AI search with citations (prefer varied angles over single query)
- **mcp__webaccess__code_search** — find code examples, API docs, tutorials
- **mcp__webaccess__fetch_content** — extract readable content from URL/GitHub/YouTube/video files
- **mcp__webaccess__get_search_content** — retrieve full results from prior searches by responseId

### User Interaction
- **mcp__ask_user** — keyboard-driven structured questions (choices or free-text)

### Planning
- **plannotator_submit_plan** — submit multi-step markdown plan for review

---

## When to Use Each

| Goal | Tool |
|------|------|
| Understand unfamiliar codebase | scout (cheap, maps everything) |
| Make code changes | Edit (surgical, minimal edits) |
| Check my edits for bugs | review (auto-call recommended) |
| Find tests to write | tests (identifies gaps) |
| Check for security issues | security (traces sources to sinks) |
| Multi-file exploration | Bash (grep, find) |
| Research APIs / libraries | mcp__webaccess__code_search |
| Answer factual questions | mcp__webaccess__web_search (multi-query) |
| Clarify ambiguous requirements | mcp__ask_user (keyboard choices) |
| Complex multi-step work | plannotator_submit_plan (then execute) |

**Pro tip:** This template is always available. Type `/tools` in the editor to bring it back.
