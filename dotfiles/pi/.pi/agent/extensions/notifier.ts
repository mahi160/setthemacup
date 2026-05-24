/**
 * notifier.ts — macOS Notification Center alert on agent completion.
 *
 * Fires when the agent finishes a run so you know it's ready even if the
 * terminal is in the background.
 *
 * Skips notification for fast/short runs (< MIN_DURATION_MS). This avoids
 * noisy alerts from quick slash commands like /commit or /review that finish
 * in under a second.
 *
 * To change the threshold, adjust MIN_DURATION_MS.
 * macOS only — osascript is a no-op on Linux/Windows (execFile will just fail silently).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { basename } from "node:path";

/** Runs shorter than this are skipped — fast commands, /commit, etc. */
const MIN_DURATION_MS = 3_000;

function notify(title: string, subtitle: string, body: string): void {
  const script = [
    `display notification "${body}"`,
    `with title "${title}"`,
    `subtitle "${subtitle}"`,
  ].join(" ");
  execFile("osascript", ["-e", script], { timeout: 5_000 }, () => {});
}

export default function (pi: ExtensionAPI): void {
  let agentStartedAt = 0;

  pi.on("agent_start", () => {
    agentStartedAt = Date.now();
  });

  pi.on("agent_end", (_event, ctx: ExtensionContext) => {
    if (Date.now() - agentStartedAt < MIN_DURATION_MS) return;
    notify("π", basename(ctx.cwd ?? ""), "Ready for input");
  });
}
