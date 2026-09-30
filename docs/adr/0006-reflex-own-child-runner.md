# pi-reflex owns its child runner instead of reusing pi-spawn's

`pi-reflex` spawns delegated children with its own runner rather than sharing `pi-spawn`'s child-runner and ask-bridge (ADR 0004). The two have opposite interaction models. `pi-spawn` runs one fast command at a time in the background while the user keeps typing, so it defers child questions behind a `ctrl+shift+a` pending indicator. A delegation, in contrast, blocks the orchestrator's tool call, may run several read-only children in parallel, and must surface a child's flag immediately as a real dialog, or an unattended auto-mode run would sit idle behind a hidden indicator. Sharing one runner would force one of the two to carry the other's scheduling and question semantics.

## Consequences

There are two RPC child runners in the pi config. Both must keep global extensions loaded in the child (ADR 0004's OAuth/billing reason), and a fix to RPC event handling in one should be checked against the other.
