import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionEvent,
} from "@mariozechner/pi-coding-agent";
import { StatusWidget } from "./utils.js";
export default function (pi: ExtensionAPI) {
  let widget: StatusWidget | undefined;

  pi.on("session_start", (_, ctx: ExtensionContext) => {
    ctx.ui.setFooter(() => ({ render: () => [], invalidate() {} }));

    if (ctx.model) {
      widget = new StatusWidget(pi, ctx, ctx.model);
      widget.update();
    }
  });

  pi.on("model_select", (event: ExtensionEvent) => {
    if (!widget) return;
    widget.model = event.model;
    widget.update();
  });

  pi.on("turn_end", () => {
    widget?.update();
  });
}
