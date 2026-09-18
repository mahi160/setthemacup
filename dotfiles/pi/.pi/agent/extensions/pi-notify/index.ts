import { execFile } from "node:child_process";
import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Outcome = {
  failed: boolean;
  preview: string;
};

const MIN_DURATION_MS = 3_000;
const SUCCESS_SOUND = "Glass";
const ERROR_SOUND = "Basso";
const SOUND_DIR = "/System/Library/Sounds";

function notify(title: string, subtitle: string, message: string, sound: string): void {
  if (process.platform !== "darwin") return;

  execFile(
    "terminal-notifier",
    ["-title", title, "-subtitle", subtitle, "-message", message],
    { stdio: "ignore" },
  ).on("error", () => {
    // terminal-notifier may not be installed on every machine.
  });

  // peon-ping handles sounds now
  // execFile("afplay", [`${SOUND_DIR}/${sound}.aiff`], { stdio: "ignore" }).on(
  //   "error",
  //   () => {},
  // );
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function assistantOutcome(messages: unknown[]): Outcome {
  const assistant = messages
    .filter((message): message is {
      role: "assistant";
      stopReason?: string;
      errorMessage?: string;
      content?: unknown;
    } =>
      typeof message === "object" &&
      message !== null &&
      (message as { role?: string }).role === "assistant",
    )
    .at(-1);

  if (!assistant) return { failed: false, preview: "Ready for input" };

  const failed =
    assistant.stopReason === "error" || assistant.stopReason === "aborted";
  if (failed) {
    return {
      failed: true,
      preview: (assistant.errorMessage ?? "Agent stopped").slice(0, 100),
    };
  }

  const preview = Array.isArray(assistant.content)
    ? assistant.content
        .filter(
          (block): block is { type: "text"; text: string } =>
            typeof block === "object" &&
            block !== null &&
            (block as { type?: string }).type === "text" &&
            typeof (block as { text?: unknown }).text === "string",
        )
        .map((block) => block.text)
        .join(" ")
        .replace(/\*\*Touched:\*\*[\s\S]*$/, "")
        .trim()
        .slice(0, 100)
    : "";

  return { failed: false, preview: preview || "Ready for input" };
}

export default function (pi: ExtensionAPI): void {
  let startedAt = 0;
  let outcome: Outcome = { failed: false, preview: "Ready for input" };
  let promptDepth = 0;
  let promptNotified = false;

  pi.on("agent_start", () => {
    startedAt = Date.now();
    outcome = { failed: false, preview: "Ready for input" };
  });

  pi.on("agent_end", (event) => {
    outcome = assistantOutcome(event.messages);
  });

  pi.on("agent_settled", (_event, ctx) => {
    const durationMs = startedAt ? Date.now() - startedAt : 0;
    if (durationMs < MIN_DURATION_MS) return;

    const project = basename(ctx.cwd);
    const subtitle = `${project} · ${formatDuration(durationMs)}`;
    notify(
      outcome.failed ? "π ✗" : "π ✓",
      subtitle,
      outcome.preview,
      outcome.failed ? ERROR_SOUND : SUCCESS_SOUND,
    );
  });

  pi.on("ui_prompt_start", (_event, ctx) => {
    promptDepth += 1;
    if (promptNotified) return;

    promptNotified = true;
    notify("π ?", basename(ctx.cwd), "Waiting for input", SUCCESS_SOUND);
  });

  pi.on("ui_prompt_end", () => {
    promptDepth = Math.max(0, promptDepth - 1);
    if (promptDepth === 0) promptNotified = false;
  });
}
