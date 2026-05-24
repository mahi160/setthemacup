/**
 * notifier.ts — Native macOS notification on agent completion.
 *
 * Sends a Notification Center alert via osascript when the LLM
 * finishes a run, so you know it's ready even if the terminal
 * is in the background.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { basename } from "node:path";

function notify(title: string, subtitle: string, body: string): void {
  const script = [
    `display notification "${body}"`,
    `with title "${title}"`,
    `subtitle "${subtitle}"`,
  ].join(" ");
  execFile("osascript", ["-e", script], { timeout: 5_000 }, () => {});
}

export default function (pi: ExtensionAPI): void {
  pi.on("agent_end", (_event, ctx: ExtensionContext) => {
    notify("π", basename(ctx.cwd ?? ""), "Ready for input");
  });
}
