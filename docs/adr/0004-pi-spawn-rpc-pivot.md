# fast-commands merges into pi-spawn, spawns via `--mode rpc` instead of `pi -p`

Status: supersedes the execution mechanics of ADR 0001 (the JSON registry from ADR 0002 stands unchanged).

The 6 fast-commands (`/commit`, `/pr`, `/pr-check`, `/standup`, `/review`, `/test`) are implemented in `extensions/pi-spawn/index.ts` — the same extension that already owned `/spawn <task>` — instead of a separate `fast-commands` extension. Both entry points share one child-runner and ask-bridge. `/spawn` keeps its original restricted-tools, fixed-cheap-model, read-only behavior; the fast-commands get full tool access and their own per-command model/thinking from `commands.json`.

The child is spawned with `--mode rpc`, not `pi -p`. Print mode (`-p`, and `--mode json -p`) exits after the final answer with no way to hold an interactive round-trip — that's why the original design needed an `ASK:`-sentinel-and-rerun hack to fake a question back to the user (capped at 3 rounds, and still not real-time). RPC mode streams live events and can hold the child process open across a genuine `extension_ui_request`/`extension_ui_response` round-trip, so the ask-bridge is now a real relay, not a rerun.

The child keeps the same global extensions/packages as the interactive session (no `--no-extensions`) — only session history is dropped (`--no-session`). Dropping extensions entirely also drops OAuth/billing compat (`pi-claude` and friends), which made every spawned child bill as pay-per-use "extra usage" instead of the Pro/Max subscription and fail with a 400 once that pool was exhausted.

Consequence: only one fast-command run is in flight at a time (module-level `active` state) — no background scheduler. When the child asks a question, the widget does not auto-pop a dialog; it shows a pending-question indicator and waits for `ctrl+shift+a`, which either answers the pending question or (if nothing is pending) dumps the full run log into the transcript via `pi.appendEntry`/`registerEntryRenderer`. See CONTEXT.md for the updated `Ask-bridge` and new `Pending question` terms.

The finished run's result is delivered to the master session via `pi.sendMessage` (`triggerTurn: true`), not `ctx.ui.notify` — a toast is ephemeral and invisible to the model, so the master session never saw or acted on a fast-command's output. `sendMessage` puts it in the transcript (rendered as a bordered box via `registerMessageRenderer`, matching the running-widget's box style) and in LLM context, and immediately hands control back to the master for a follow-up turn.

`~/.pi/agent/prompts/commit.md` and `prompts/review.md` (pi's built-in prompt-template mechanism — unrelated to this extension, but any `.md` filename there also becomes a `/name` command) were deleted: they predate `pi-spawn`'s fast-commands and collided with its `/commit`/`/review`, showing as duplicate entries in autocomplete.
