/**
 * notifier.ts — OS notification alerts for key agent events.
 *
 * Notifies on:
 *   - agent_end: agent finishes (success or error), duration shown
 *   - ask_user: any kind of ask (confirmation, choice, multi-select)
 *
 * Skips agent_end under MIN_DURATION_MS (fast responses) and while auto-retry
 * is still in flight (willRetry) — only the final outcome should ping.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { notify } from "./shared/notify.js";
import { basename } from "node:path";

const MIN_DURATION_MS = 3_000;

function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export default function (pi: ExtensionAPI): void {
  let agentStartedAt = 0;

  pi.on("agent_start", () => {
    agentStartedAt = Date.now();
  });

  pi.on("agent_end", (event, ctx: ExtensionContext) => {
    if ((event as unknown as { willRetry?: boolean }).willRetry) return;

    const durationMs = Date.now() - agentStartedAt;
    if (durationMs < MIN_DURATION_MS) return;

    const subtitle = `${basename(ctx.cwd ?? "unknown")} · ${fmtDuration(durationMs)}`;
    const lastAssistant = (event.messages as AssistantMessage[])
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");

    const isError =
      lastAssistant?.stopReason === "error" ||
      lastAssistant?.stopReason === "aborted";

    if (isError) {
      notify({
        title: "π ✗",
        subtitle,
        body: (lastAssistant?.errorMessage ?? "unknown error").slice(0, 100),
        sound: "error",
      });
      return;
    }

    const content = lastAssistant?.content;
    const preview = Array.isArray(content)
      ? (content as Array<{ type: string; text?: string }>)
          .filter((b) => b.type === "text" && b.text)
          .map((b) => b.text!)
          .join(" ")
          .replace(/\*\*Touched:\*\*[\s\S]*$/, "")
          .trim()
          .slice(0, 100)
      : "";

    notify({
      title: "π ✓",
      subtitle,
      body: preview || "Ready for input",
      sound: "success",
    });
  });

  pi.on("tool_call", (event) => {
    if (!isToolCallEventType("ask_user", event)) return;
    const params = event.input as {
      question?: string;
      questions?: Array<{ question: string }>;
    };
    const first = params.question ?? params.questions?.[0]?.question ?? "";
    notify({
      title: "π ?",
      subtitle: "Waiting for input",
      body: first.slice(0, 80),
      sound: "question",
    });
  });
}
