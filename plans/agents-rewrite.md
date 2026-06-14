# Agents Extension — Clean Rewrite

## Context

The existing `agents/` extension accumulated two separate configs (`fast-commands.json`, `subagents.json`), three handler files, and a shared utility layer. It had a broken `getMarkdownTheme` import, wrong model, and budget-guard interference in subprocesses. The user wants a clean slate: one config, simple code, same capabilities.

## What stays, what goes

| | Keep | Delete |
|--|------|--------|
| `agents/index.ts` | rewrite | old file |
| `agents/handlers/command.ts` | ✗ | delete |
| `agents/handlers/tool.ts` | ✗ | delete |
| `agents/handlers/custom.ts` | ✗ | delete (see Q1 below) |
| `agents/config/fast-commands.json` | ✗ | delete |
| `agents/config/subagents.json` | ✗ | delete |
| `agents/config/prompts/commands/*.md` | move → `agents/config/prompts/` | old paths |
| `agents/config/prompts/subagents/*.md` | move → `agents/config/prompts/` | old paths |
| `shared/spawn-subagent.ts` | keep (works fine) | — |
| `shared/command-runner.ts` | keep | — |

## New file layout

```
extensions/agents/
├── index.ts              ← entire extension: spawn + user cmds + AI tools + renderer
└── config/
    ├── agents.json       ← unified config (replaces both JSON files)
    └── prompts/          ← flat dir, one .md per agent
        ├── commit.md
        ├── pr.md
        ├── standup.md
        ├── review.md     ← user-called (two-axis review prompt)
        ├── test.md
        ├── scout.md
        ├── diff-review.md  ← AI-called (was subagents/review.md)
        ├── tests.md
        └── security.md
```

## `agents.json` schema

```jsonc
{
  "agents": [
    {
      "name":        "commit",              // slash command name / tool name
      "label":       "Commit",              // display name in widget + renderer
      "icon":        "󰜘",                  // nerd font icon
      "type":        "user",               // "user" | "ai"
      "output":      "notify",             // "notify" | "inline"  (user only)
      "model":       "anthropic/claude-haiku-4",  // passed to pi --model
      "thinking":    "off",                // "off" | "low" | "medium" | "high"
      "tools":       ["bash", "read"],     // passed to pi --tools
      "file":        "prompts/commit.md",  // relative to config dir
      "description": "Generate and apply a conventional commit"
      // AI-type only:
      // "guidelines": ["Use scout when ..."]  → injected into main agent system prompt
    }
  ]
}
```

- **`type: "user"`** → registered as `/name` slash command
- **`type: "ai"`** → registered as LLM-callable tool with params `{ task, paths?, maxFiles? }`
- **`output: "notify"`** → toast with last line of output (e.g. commit)
- **`output: "inline"`** → rendered markdown block inline in conversation

## Subprocess invocation (via existing `shared/spawn-subagent.ts`)

```
pi --model <model>
   --no-session
   --no-extensions        ← stops budget-guard etc. from loading
   --no-context-files
   --no-skills
   --thinking <level>
   --tools <tool1,tool2>
   --mode json
   -p "<role + instructions>"
```

For AI tools, the task/paths params are appended to the prompt before spawning.

## `index.ts` structure

```typescript
// 1. Load agents.json, read each .md file
// 2. For type:user  → registerCommand, run + display
// 3. For type:ai    → registerTool, run + return text to main agent
// 4. registerMessageRenderer("agent-result", ...) for "inline" output
// 5. Widget (spinner + tool tracker) via setWidget during execution
```

No handler split — everything in one readable file (~200 lines).

## Output for user-called agents

| output | mechanism |
|--------|-----------|
| `"notify"` | `ctx.ui.notify(✓ /name: <last line>)` |
| `"inline"` | `pi.sendMessage({ customType: "agent-result", display: true, details: { label, text } })` with renderer using `Markdown` from `@earendil-works/pi-tui` + `getMarkdownTheme` from `@earendil-works/pi-coding-agent` (correct imports) |

Inline result does **not** add to LLM context (it's a display-only custom message, `triggerTurn: false`).

## Decisions

1. **`/sub` + `custom_agent` tool** — keep. `/sub <agent> <task>` inline (no picker). `/sub` alone lists agents. `custom_agent` tool for AI to call any agent with a task.
2. **Inline output** — darker custom block is acceptable. No extra LLM call.

## Files to create/modify

- **Create** `dotfiles/pi/.pi/agent/extensions/agents/index.ts`
- **Create** `dotfiles/pi/.pi/agent/extensions/agents/config/agents.json`
- **Create** `dotfiles/pi/.pi/agent/extensions/agents/config/prompts/diff-review.md` (rename from subagents/review.md)
- **Move/rename** existing `.md` prompt files into flat `prompts/` dir
- **Delete** `agents/handlers/` directory contents
- **Delete** `agents/config/fast-commands.json`
- **Delete** `agents/config/subagents.json`

## Steps

- [ ] Answer open questions
- [ ] Write `agents.json` with all 9 agents
- [ ] Write new `index.ts`
- [ ] Move/flatten prompt files
- [ ] Delete old handlers and config files
- [ ] Test `/standup`, `/commit`, `scout` tool

## Verification

```bash
# In pi after /reload:
/standup          # should show inline markdown
/commit           # should show toast notification
# Ask main agent: "use scout to map this repo" → should spawn scout tool
```
