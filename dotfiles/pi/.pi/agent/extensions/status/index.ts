import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { ToolWidget } from "./tools.js";
import { StatusWidget } from "./widget.js";

export default function (pi: ExtensionAPI) {
  let status: StatusWidget | undefined;
  let tools: ToolWidget | undefined;

  pi.on("session_start", (_, ctx: ExtensionContext) => {
    ctx.ui.setFooter(() => ({ render: () => [], invalidate() {} }));

    status = ctx.model ? new StatusWidget(pi, ctx, ctx.model) : undefined;
    tools = new ToolWidget(ctx);
    status?.update();
  });

  pi.on("model_select", (event) => {
    if (!status) return;
    status.model = event.model;
    status.update();
  });

  pi.on("tool_execution_start", (event) => {
    tools?.start(event.toolName);
  });

  pi.on("tool_execution_end", (event) => {
    tools?.end(event.toolName);
  });

  pi.on("agent_end", () => {
    tools?.clearActive();
  });

  pi.on("turn_end", () => {
    status?.update();
  });
}
