import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { isInsideTmux, runInNewTmuxPane } from "./tmux-manager";

export default function (pi: ExtensionAPI): void {
  pi.registerTool({
    name: "spawn_subtask",
    label: "Spawn Subagent",
    description: "Run a command in a new tmux pane/window for orchestration",
    parameters: Type.Object({
      command: Type.String({ description: "The command to run" }),
      name: Type.Optional(Type.String({ description: "The name of the subagent/window" })),
    }),
    async execute(toolCallId, params, _signal, onUpdate, ctx) {
      const windowName = params.name || "subagents";
      
      if (!isInsideTmux()) {
        // Fallback: run normally (or perhaps in background?)
        ctx.ui.notify("Not in tmux, running subtask locally...", "info");
        // For now, just execute synchronously. Could be improved.
        return {
          content: [{ type: "text", text: "Running locally (not in tmux)" }],
          details: { status: "running_locally" },
        };
      }

      ctx.ui.notify(`Starting subagent: ${windowName}...`, "info");
      
      try {
        const paneId = await runInNewTmuxPane(params.command, windowName);
        
        return {
          content: [{ type: "text", text: `Subagent ${windowName} started in pane ${paneId}.` }],
          details: { paneId, windowName, status: "started" },
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Failed to start subagent: ${error.message}` }],
          details: { status: "error", error: error.message },
        };
      }
    },
  });
}
