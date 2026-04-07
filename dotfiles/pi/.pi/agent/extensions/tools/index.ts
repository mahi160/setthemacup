import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const counts = new Map<string, number>();
  let ctx: ExtensionContext | undefined;

  function render() {
    if (!ctx) return;

    if (counts.size === 0) {
      ctx.ui.setWidget("tool-calls", undefined);
      return;
    }

    const lines = [...counts.entries()].map(
      ([name, count]) => `${count > 1 ? `[${count}x] ` : "       "}${name}`
    );

    ctx.ui.setWidget("tool-calls", lines, { placement: "aboveEditor" });
  }

  pi.on("session_start", (_event, c) => {
    ctx = c;
    counts.clear();
    render();
  });

  pi.on("tool_execution_start", (event) => {
    counts.set(event.toolName, (counts.get(event.toolName) ?? 0) + 1);
    render();
  });

  pi.on("agent_end", () => {
    counts.clear();
    render();
  });
}
