# pi-orca delegates with fixed roles and shares pi-spawn's child runner

`pi-orca` gives the main session a `delegate` tool that hands one self-contained subtask to a child pi on a cheaper model. The orchestrator (Opus 5.5, medium thinking) keeps every tool, including `edit` and `write`, and picks one of four fixed roles per call: `scout` (Haiku, read-only), `tester` (Haiku, runs checks), `coder` (Sonnet, full tools), and `reviewer` (Sonnet, reviews the diff). Each role has a fixed model, thinking level, tool set, and prompt in `pi-orca/index.ts`.

## Considered Options

- **Router model (Jev) picks the worker model** — rejected. The orchestrator already knows what kind of work it hands off, and four roles map one-to-one onto models. A router adds a model hop, latency, and a lossy handoff with no decision left to make, and third-party router packages would see the OAuth token.
- **Orchestrator without edit/write** — rejected. Writing code is cheap: an Opus session's cost is mostly the context re-sent each turn, not output tokens. The savings come from keeping reading-heavy work (exploration, test output) out of the orchestrator's context. Removing edit/write would turn every small fix into a delegation round trip that costs more than the edit.
- **A separate child runner for delegation** — rejected. pi-spawn and a delegation need different scheduling and question handling, but that lives in the callers, not in the runner: `extensions/lib/child-pi.ts` takes `onAsk`, `onLog`, `onTool`, and `onText` callbacks. pi-spawn keeps its deferred `ctrl+shift+a` ask, while pi-orca shows dialogs immediately, one at a time. One runner means a fix to RPC event handling lands once.

## Consequences

- Every child gets `PI_CHILD=1`. pi-orca does nothing in a child, so delegation never nests, including in pi-spawn's fast commands and the `pi -p` children their prompts start.
- `coder` calls run one at a time because they share the working tree; the other roles run in parallel.
- Child usage is returned as the tool result's `usage`, so session totals include worker spend.
- `/orca` toggles the `delegate` tool; its prompt guidelines appear only while it is active.
