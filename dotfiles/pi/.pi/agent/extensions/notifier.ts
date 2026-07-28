/**
 * notifier.ts — macOS Notification Center alerts for key events.
 *
 * Notifies on:
 *   - agent_end: Agent finishes (success or error), duration shown
 *   - error: Agent error or abort
 *   - ask_user: Any kind of ask (confirmation, choice, multi-select)
 *   - subagent end: Subagent tool completes
 *
 * Features:
 *   - Sound: "Glass" on success/complete, "Basso" on error
 *   - Duration shown on agent completion
 *   - Error message shown on error/abort
 *   - Question text shown on ask_user
 *   - Subagent name shown on completion
 *   - Skips agent_end if duration < MIN_DURATION_MS (fast responses)
 *
 * macOS only — execFile("osascript") will silently fail on Linux/Windows.
 * Sound names are from /System/Library/Sounds/ (no extension needed).
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { notifyMacOS } from "./shared/macOS-notify.js";
import { basename } from "node:path";

const MIN_DURATION_MS = 3_000;
const SUCCESS_SOUND = "Hero";     // Notification on agent success
const ERROR_SOUND = "Basso";      // Notification on agent error
const ASK_SOUND = "Ping";         // Notification on ask_user

/** Formats milliseconds as "8.3s" or "2m 4s". */
function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export default function (pi: ExtensionAPI): void {
  let agentStartedAt = 0;

  // ─── agent_end: Notify on agent completion (success or error) ───
  // Also fires on error/abort, but agent_end is the main event

  pi.on("agent_start", () => {
    agentStartedAt = Date.now();
  });

  pi.on("agent_end", (event, ctx: ExtensionContext) => {
    // Don't notify on auto-retried failures — wait for the final outcome
    if ((event as unknown as { willRetry?: boolean }).willRetry) return;

    const durationMs = Date.now() - agentStartedAt;
    if (durationMs < MIN_DURATION_MS) return;

    const project = basename(ctx.cwd ?? "unknown");
    const duration = fmtDuration(durationMs);
    const subtitle = `${project} · ${duration}`;

    const lastAssistant = (event.messages as AssistantMessage[])
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");

    const isError =
      lastAssistant?.stopReason === "error" ||
      lastAssistant?.stopReason === "aborted";

    if (isError) {
      const errMsg = (lastAssistant?.errorMessage ?? "unknown error").slice(
        0,
        100,
      );
      notifyMacOS("π ✗", subtitle, errMsg, ERROR_SOUND);
    } else {
      const content = lastAssistant?.content;
      const rawPreview = Array.isArray(content)
        ? (content as Array<{ type: string; text?: string }>)
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text!)
            .join(" ")
            .trim()
        : "";
      const preview = rawPreview
        .replace(/\*\*Touched:\*\*[\s\S]*$/, "")
        .trimEnd()
        .slice(0, 100);

      notifyMacOS("π ✓", subtitle, preview || "Ready for input", SUCCESS_SOUND);
    }
  });

  // ─── ask_user: Notify when question is asked ───

  pi.on("tool_call", (event, ctx) => {
    if (isToolCallEventType("ask_user", event)) {
      const params = event.input as { question?: string; questions?: Array<{ question: string }> };
      const first = params.question ?? params.questions?.[0]?.question ?? "";
      notifyMacOS("π ?", "Waiting for input", first.slice(0, 80), ASK_SOUND);
    }
  });

}
