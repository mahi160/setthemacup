import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { StatusWidget } from "./widget.js";

export default function (pi: ExtensionAPI) {
  let widget: StatusWidget | undefined;
  let savedCtx: ExtensionContext | undefined;

  pi.on("session_start", (_, ctx: ExtensionContext) => {
    ctx.ui.setFooter(() => ({ render: () => [], invalidate() {} }));
    savedCtx = ctx;
    widget = ctx.model ? new StatusWidget(pi, ctx, ctx.model) : undefined;
    widget?.update();
  });

  // BUG FIX: create widget if it doesn't exist yet (model wasn't set at session_start)
  pi.on("model_select", (event) => {
    if (widget) {
      widget.model = event.model;
      widget.update();
    } else if (savedCtx) {
      widget = new StatusWidget(pi, savedCtx, event.model);
      widget.update();
    }
  });

  pi.on("tool_execution_start", (event) => {
    widget?.startTool(event.toolName);
  });

  pi.on("turn_end", () => {
    widget?.update();
  });
}
