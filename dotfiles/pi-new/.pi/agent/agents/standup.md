---
name: standup
description: Generate daily standup from git activity
tools: bash
model: anthropic/claude-haiku-4-5
thinking: off
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
output: inline
icon: 󰟌
command: true
---
1. `git log --since="24 hours ago" --oneline --author="$(git config user.name)"`.
2. `git diff HEAD~5...HEAD --stat` for recent changes.
3. Summarize: **Yesterday** (from commits), **Today** (infer from WIP/last commit), **Blockers** (none unless context suggests).
4. Short — 3-5 bullets max.
