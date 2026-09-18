/**
 * pi-peon-adapter only plays the input.required sound via the
 * `permissions:ui_prompt` event bus (from @gotgenes/pi-permission-system),
 * which our local pi-permissions extension doesn't emit. Bridge pi's native
 * ui_prompt_start hook (fires for any UI prompt: ask_user_question,
 * permission confirms, etc.) straight to `peon` so questions get a sound.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function pingPeon(cwd: string): void {
  const peonBin = process.env.PEON_BIN || "peon";
  let child;
  try {
    child = spawn(peonBin, [], { stdio: ["pipe", "ignore", "ignore"] });
  } catch {
    return;
  }
  child.on("error", () => {});
  child.stdin?.on("error", () => {});
  try {
    child.stdin?.write(
      JSON.stringify({
        hook_event_name: "PermissionRequest",
        tool_name: "prompt",
        session_id: `pi-${randomUUID()}`,
        cwd,
      }),
    );
    child.stdin?.end();
  } catch {
    // best-effort; no sound is not worth crashing over
  }
}

export default function (pi: ExtensionAPI): void {
  let promptDepth = 0;
  let promptNotified = false;

  pi.on("ui_prompt_start", (_event, ctx) => {
    promptDepth += 1;
    if (promptNotified) return;
    promptNotified = true;
    pingPeon(ctx.cwd);
  });

  pi.on("ui_prompt_end", () => {
    promptDepth = Math.max(0, promptDepth - 1);
    if (promptDepth === 0) promptNotified = false;
  });
}
