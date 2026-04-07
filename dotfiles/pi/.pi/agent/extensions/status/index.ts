import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { StatusWidget } from "./widget.js";

export default function (pi: ExtensionAPI) {
  let widget: StatusWidget | undefined;

  pi.on("session_start", (_: any, ctx: ExtensionContext) => {
    ctx.ui.setFooter(() => ({ render: () => [], invalidate() {} }));

    if (ctx.model) {
      widget = new StatusWidget(pi, ctx, ctx.model);
      widget.update();
    }
  });

  pi.on("model_select", (event: { model: any }) => {
    if (!widget) return;
    widget.model = event.model;
    widget.update();
  });

  pi.on("tool_execution_start", (event: { toolName: string }) => {
    widget?.setTool(event.toolName);
  });

  pi.on("agent_end", () => {
    widget?.clearTools();
  });

  pi.on("turn_end", () => {
    widget?.update();
  });
}
