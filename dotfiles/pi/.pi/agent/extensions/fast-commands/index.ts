/**
 * fast-commands.ts — User-facing slash commands (/commit, /pr, /standup) that run in clean, ephemeral pi sessions.
 *
 * Each command references an agent defined in subagents.json (via agentRef).
 * Spawns `pi --mode json -p "..."` as a subprocess so the current session's
 * context is NEVER injected. Structured JSON events drive a live widget:
 * braille spinner, elapsed time, current tool, streaming text.
 *
 * Result display via "output" in fast-commands.json:
 *   "notify" — last line shown as notification toast
 *   "file"   — full output injected inline via registerMessageRenderer
 *
 * Agent config (prompt, thinking, tools, role) come from subagents.json.
 * Models fallback to subagents.json models if not in fast-commands.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  visibleWidth,
  truncateToWidth,
  Markdown,
} from "@earendil-works/pi-tui";
import {
  getMarkdownTheme,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type Theme,
} from "@earendil-works/pi-coding-agent";

// ── Border helpers ───────────────────────────────────────────────────────────

/**
 * Wraps an array of pre-styled lines in a rounded box.
 * Each line should already be truncated to width-4 visible chars.
 * Border styled with theme borderMuted.
 */
function bordered(lines: string[], width: number, theme: Theme): string[] {
  const b = (s: string) => theme.fg("borderMuted", s);
  const bar = "─".repeat(Math.max(0, width - 2));
  const innerW = Math.max(0, width - 4);
  return [
    b("╭" + bar + "╮"),
    ...lines.map((line) => {
      const displayLine = truncateToWidth(line, innerW);
      const pad = " ".repeat(Math.max(0, innerW - visibleWidth(displayLine)));
      return b("│") + " " + displayLine + pad + " " + b("│");
    }),
    b("╰" + bar + "╯"),
  ];
}

// ── Config schema ─────────────────────────────────────────────────────────────

interface Model {
  provider: string;
  id: string;
}

interface FastCommand {
  name: string;
  agentRef: string; // references an agent name in subagents.json
  output?: "notify" | "file"; // "notify" = last-line toast, "file" = open .md
}

interface FastCommandsConfig {
  commands: FastCommand[];
}

interface SubagentConfig {
  name: string;
  label: string;
  description: string;
  role: string;
  prompt: string | string[];
  thinking?: string;
  tools?: string[];
  icon?: string;
}

interface SubagentConfigFull {
  models: Model[];
  agents: SubagentConfig[];
}

const fastCommandsConfigPath = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fast-commands.json",
);
const fastCommandsConfig: FastCommandsConfig = JSON.parse(
  readFileSync(fastCommandsConfigPath, "utf-8"),
);

const subagentsConfigPath = join(
  fileURLToPath(new URL("../subagents", import.meta.url)),
  "subagents.json",
);
let subagentsConfig: SubagentConfigFull | undefined;
try {
  subagentsConfig = JSON.parse(readFileSync(subagentsConfigPath, "utf-8"));
} catch (err) {
  console.warn("[fast-commands] subagents.json not found:", err);
}

// ── Spinner ───────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

// ── Widget state ──────────────────────────────────────────────────────────────

interface WidgetState {
  spinnerFrame: number;
  elapsedMs: number;
  currentTool: string; // e.g. "bash: git diff --cached"
  toolCount: number; // tools completed so far
  recentText: string[]; // last 2 non-empty lines of streamed assistant text
  retrying: boolean;
  retryAttempt: number;
}

// ── Session-level state ───────────────────────────────────────────────────────
// Mutex: one fast command at a time.
// Resolved model cached per session — credentials don't change mid-session.

let activeCommand = "";
let activeAbort: AbortController | undefined;
let cachedModel: Model | null | undefined = undefined;
// undefined = not yet resolved, null = resolved but none available

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildMessage(agent: SubagentConfig): string {
  const body = Array.isArray(agent.prompt) ? agent.prompt.join("\n") : agent.prompt;
  return `Role: ${agent.role}.\n\n${body}`;
}

/**
 * Formats a tool name + args into a concise readable string for the widget.
 *   bash  → "bash: git diff --cached"
 *   read  → "read: src/index.ts"
 *   grep  → "grep: somePattern"
 */
function formatTool(
  name: string | undefined,
  args: Record<string, unknown> | undefined,
): string {
  if (!name) return "";
  const n = name.toLowerCase();
  if (!args) return n;
  if (n === "bash" && typeof args.command === "string")
    return `bash: ${args.command.slice(0, 60)}`;
  if (
    (n === "read" || n === "write" || n === "edit") &&
    typeof args.path === "string"
  )
    return `${n}: ${args.path}`;
  if (n === "grep" && typeof args.pattern === "string")
    return `grep: ${args.pattern}`;
  return n;
}

/**
 * Parses one JSONL line from `--mode json` output.
 * Mutates `state` for tool/retry/spinner events.
 * Appends assistant text deltas to `textAcc.value` and refreshes `state.recentText`.
 */
function parseJsonEvents(
  line: string,
  state: WidgetState,
  textAcc: { value: string },
): void {
  let event: {
    type: string;
    toolName?: string;
    args?: Record<string, unknown>;
    assistantMessageEvent?: { type: string; delta?: string };
    attempt?: number;
  };
  try {
    event = JSON.parse(line);
  } catch {
    return; // skip non-JSON lines (startup noise, etc.)
  }

  switch (event.type) {
    case "tool_execution_start":
      state.currentTool = formatTool(event.toolName, event.args);
      break;
    case "tool_execution_end":
      state.currentTool = "";
      state.toolCount++;
      break;
    case "message_update": {
      const ame = event.assistantMessageEvent;
      if (ame?.type === "text_delta" && ame.delta) {
        textAcc.value += ame.delta;
        state.recentText = textAcc.value
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(-2);
      }
      break;
    }
    case "auto_retry_start":
      state.retrying = true;
      state.retryAttempt = event.attempt ?? 1;
      break;
    case "auto_retry_end":
      state.retrying = false;
      break;
  }
}

/**
 * Spawns pi in ephemeral JSON-stream mode.
 * Lines are parsed into structured events that update `widgetState` live.
 * Full assistant text is accumulated and returned as `fullText` on exit.
 * Subprocess is killed via SIGTERM when `signal` fires.
 */
function spawnCleanSession(
  modelFlag: string,
  thinking: string,
  prompt: string,
  signal: AbortSignal,
  widgetState: WidgetState,
  onUpdate: () => void,
): Promise<{ exitCode: number | null; fullText: string }> {
  return new Promise((resolve) => {
    const textAcc = { value: "" };
    let lineBuffer = "";

    const proc = spawn(
      "pi",
      [
        "--model",
        modelFlag,
        "--no-session",
        "--no-context-files", // fast commands have own prompts — skip AGENTS.md
        "--no-skills", // fast commands don't invoke skills
        "--thinking",
        thinking,
        "--mode",
        "json",
        "-p",
        prompt,
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      },
    );

    proc.stdout.on("data", (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? ""; // keep incomplete trailing line
      for (const line of lines) {
        if (line.trim()) {
          parseJsonEvents(line, widgetState, textAcc);
          onUpdate();
        }
      }
    });

    proc.on("close", (code) => {
      // flush any remaining buffered content
      if (lineBuffer.trim()) parseJsonEvents(lineBuffer, widgetState, textAcc);
      resolve({ exitCode: code, fullText: textAcc.value.trim() });
    });

    signal.addEventListener("abort", () => proc.kill("SIGTERM"), {
      once: true,
    });
  });
}

/**
 * Resolves the first fast model with available credentials.
 * Cached per session — credentials don't change mid-session.
 * Falls back to first model to cover OAuth (no API key, but auth.json inherited by subprocess).
 */
async function resolveFastModel(
  ctx: ExtensionCommandContext,
): Promise<Model | undefined> {
  if (cachedModel !== undefined) return cachedModel ?? undefined;
  const models = subagentsConfig?.models ?? [];
  for (const candidate of models) {
    const key = await ctx.modelRegistry.getApiKeyForProvider(
      candidate.provider,
    );
    if (key) {
      cachedModel = candidate;
      return candidate;
    }
  }
  // No API key found — still try first model (OAuth subprocess inherits auth.json)
  cachedModel = models[0] ?? null;
  return cachedModel ?? undefined;
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  // ── Inline result renderer ──────────────────────────────────────────────────
  pi.registerMessageRenderer("fast-result", (message, _opts, theme) => {
    const { name, text } = message.details as { name: string; text: string };
    const header = theme.fg("success", ` ✓ /${name}`);
    const md = new Markdown(text, 1, 0, getMarkdownTheme());
    return {
      render(width: number): string[] {
        return [header, "", ...md.render(width)];
      },
      invalidate() {
        md.invalidate();
      },
    };
  });

  pi.on("session_start", () => {
    activeCommand = "";
    activeAbort?.abort();
    activeAbort = undefined;
    cachedModel = undefined;
  });

  pi.on("session_shutdown", () => {
    activeAbort?.abort();
    activeAbort = undefined;
    activeCommand = "";
    cachedModel = undefined;
  });

  // Register fast commands from config, resolving agents from subagents.json
  for (const fcmd of fastCommandsConfig.commands) {
    const agent = subagentsConfig?.agents.find((a) => a.name === fcmd.agentRef);
    if (!agent) {
      console.warn(
        `[fast-commands] Agent "${fcmd.agentRef}" not found in subagents.json`,
      );
      continue;
    }

    pi.registerCommand(fcmd.name, {
      description: `${agent.description} (clean session)`,
      handler: async (args: string, ctx: ExtensionCommandContext) => {
        if (activeCommand) {
          ctx.ui.notify(
            `Already running /${activeCommand} — wait for it to finish`,
            "warning",
          );
          return;
        }

        await ctx.waitForIdle();

        const fastModel = await resolveFastModel(ctx);
        if (!fastModel) {
          ctx.ui.notify(
            `No fast model available`,
            "error",
          );
          return;
        }

        activeCommand = fcmd.name;
        const abort = new AbortController();
        activeAbort = abort;

        const widgetState: WidgetState = {
          spinnerFrame: 0,
          elapsedMs: 0,
          currentTool: "",
          toolCount: 0,
          recentText: [],
          retrying: false,
          retryAttempt: 0,
        };

        let widgetTui: { requestRender(): void } | undefined;

        ctx.ui.setWidget(
          "fast-mode",
          (tui, theme) => {
            widgetTui = tui;
            return {
              render(width: number): string[] {
                const iw = Math.max(0, width - 4); // inner content width inside border+padding
                const spin = theme.fg(
                  "warning",
                  SPINNER_FRAMES[
                    widgetState.spinnerFrame % SPINNER_FRAMES.length
                  ]!,
                );
                const elapsed = theme.fg(
                  "dim",
                  ` ${(widgetState.elapsedMs / 1000).toFixed(1)}s`,
                );
                const header =
                  spin +
                  theme.fg("dim", ` ${fastModel.id}`) +
                  theme.fg("muted", ` → /${fcmd.name}`) +
                  elapsed;

                const inner: string[] = [header];

                if (widgetState.retrying) {
                  inner.push(
                    theme.fg(
                      "warning",
                      `↻ retry ${widgetState.retryAttempt}...`,
                    ),
                  );
                } else if (widgetState.currentTool) {
                  inner.push(
                    theme.fg(
                      "dim",
                      `⟳ ${truncateToWidth(widgetState.currentTool, iw - 2)}`,
                    ),
                  );
                }

                for (const line of widgetState.recentText) {
                  inner.push(theme.fg("dim", truncateToWidth(line, iw)));
                }

                return bordered(inner, width, theme);
              },
              invalidate() {},
            };
          },
          { placement: "belowEditor" },
        );

        // ctx.ui.notify(`⚡ ${fastModel.id} → /${cmd.name}`, "info");

        // Spinner timer — advances frame + elapsed every 100ms
        // Cleared in finally to guarantee no leak on success, error, or abort
        let spinnerTimer: ReturnType<typeof setInterval> | undefined;
        let exitCode: number | null = null;
        let fullText = "";

        try {
          spinnerTimer = setInterval(() => {
            widgetState.spinnerFrame =
              (widgetState.spinnerFrame + 1) % SPINNER_FRAMES.length;
            widgetState.elapsedMs += 100;
            widgetTui?.requestRender();
          }, 100);

          ({ exitCode, fullText } = await spawnCleanSession(
            `${fastModel.provider}/${fastModel.id}`,
            agent.thinking ?? "low",
            buildMessage(agent),
            abort.signal,
            widgetState,
            () => widgetTui?.requestRender(),
          ));
        } finally {
          // Always runs — success, thrown error, or abort
          clearInterval(spinnerTimer);
          ctx.ui.setWidget("fast-mode", undefined);
          activeCommand = "";
          activeAbort = undefined;
        }

        if (abort.signal.aborted) return;

        if (exitCode === 0) {
          if (fcmd.output === "file") {
            // Inject full output as inline message in the main session
            pi.sendMessage(
              {
                customType: "fast-result",
                content: "",
                display: true,
                details: { name: fcmd.name, text: fullText },
              },
              { triggerTurn: false },
            );
          } else {
            // Show last meaningful line as a notification toast
            const lastLine =
              fullText
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .at(-1) ?? "";
            ctx.ui.notify(
              `✓ /${fcmd.name}${lastLine ? `: ${lastLine.slice(0, 120)}` : ""}`,
              "success",
            );
          }
        } else {
          const lastLine =
            fullText
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .at(-1) ?? "";
          ctx.ui.notify(
            `✗ /${fcmd.name} failed${lastLine ? `: ${lastLine.slice(0, 120)}` : ` (exit ${exitCode})`}`,
            "error",
          );
        }
      },
    });
  }

  // Ctrl+Shift+C → /commit
  pi.registerShortcut("ctrl+shift+c", {
    description: "Quick commit (clean session)",
    handler: async () => {
      pi.sendUserMessage("/commit");
    },
  });
}
