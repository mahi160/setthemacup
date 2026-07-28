/**
 * fast-commands/spawn-subagent.ts — spawn an isolated `pi` subprocess for one
 * fast command: JSON-stream mode, parsed into widget state + accumulated
 * text/usage. See docs/adr/0001-self-owned-fast-commands.md.
 *
 * Deliberately no `--no-extensions`: ambient packages (npm:@gotgenes/pi-anthropic-auth
 * for OAuth, etc.) must stay loaded in the child — pi-subagents' own launcher
 * (src/runs/shared/pi-args.ts) does the same by default, only stripping
 * session/context-files/skills, not the whole extension set.
 */

import { spawn } from "node:child_process";
import { visibleWidth, truncateToWidth, type Theme } from "@earendil-works/pi-tui";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WidgetState {
  spinnerFrame: number;
  elapsedMs: number;
  currentTool: string;
  toolCount: number;
  recentText: string[];
  retrying: boolean;
  retryAttempt: number;
}

// Accumulated usage across a subagent's assistant messages — it runs as a
// separate `pi` process, so the main session's own stats extension never
// sees these API calls directly.
export interface UsageTotals {
  cost: number;
  totalTokens: number;
  input: number;
  output: number;
  requestCount: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

export function bordered(lines: string[], width: number, theme: Theme): string[] {
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

export function formatTool(name: string | undefined, args: Record<string, unknown> | undefined): string {
  if (!name) return "";
  const n = name.toLowerCase();
  if (!args) return n;
  if (n === "bash" && typeof args.command === "string") return `bash: ${args.command.slice(0, 60)}`;
  if ((n === "read" || n === "write" || n === "edit") && typeof args.path === "string") return `${n}: ${args.path}`;
  if (n === "grep" && typeof args.pattern === "string") return `grep: ${args.pattern}`;
  return n;
}

export function parseJsonEvents(
  line: string,
  state: WidgetState,
  textAcc: { value: string },
  errAcc?: { value: string },
  usageAcc?: UsageTotals,
): void {
  let event: {
    type: string;
    toolName?: string;
    args?: Record<string, unknown>;
    assistantMessageEvent?: { type: string; delta?: string };
    attempt?: number;
    message?: {
      role?: string;
      stopReason?: string;
      errorMessage?: string;
      usage?: { totalTokens?: number; input?: number; output?: number; cost?: { total?: number } };
    };
  };
  try {
    event = JSON.parse(line);
  } catch {
    return;
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
        if (textAcc.value.length > 10_000) textAcc.value = textAcc.value.slice(-10_000);
        if (ame.delta.includes("\n") || state.recentText.length === 0) {
          state.recentText = textAcc.value.slice(-300).split("\n").map((l) => l.trim()).filter(Boolean).slice(-2);
        }
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
    case "message_end": {
      const msg = event.message;
      if (msg?.role === "assistant" && msg.usage && usageAcc) {
        usageAcc.cost += msg.usage.cost?.total ?? 0;
        usageAcc.totalTokens += msg.usage.totalTokens ?? 0;
        usageAcc.input += msg.usage.input ?? 0;
        usageAcc.output += msg.usage.output ?? 0;
        usageAcc.requestCount++;
      }
      if (msg?.stopReason === "error" && msg.errorMessage && errAcc) {
        try {
          const jsonStart = msg.errorMessage.indexOf("{");
          if (jsonStart !== -1) {
            const parsed = JSON.parse(msg.errorMessage.slice(jsonStart)) as { error?: { message?: string } };
            errAcc.value = parsed.error?.message ?? msg.errorMessage;
          } else {
            errAcc.value = msg.errorMessage;
          }
        } catch {
          errAcc.value = msg.errorMessage;
        }
      }
      break;
    }
  }
}

/**
 * Spawns a clean `pi` session in JSON-stream mode for one fast command.
 * Accumulates assistant text, parses structured events into widget state.
 */
export function spawnCleanSession(
  modelFlag: string,
  thinking: string,
  prompt: string,
  signal: AbortSignal,
  widgetState: WidgetState,
  onUpdate: () => void,
  tools?: string[],
): Promise<{ exitCode: number | null; fullText: string; errorMessage?: string; usage: UsageTotals }> {
  return new Promise((resolve) => {
    const textAcc = { value: "" };
    const errAcc = { value: "" };
    const usageAcc: UsageTotals = { cost: 0, totalTokens: 0, input: 0, output: 0, requestCount: 0 };
    let lineBuffer = "";

    const args = [
      "--model", modelFlag,
      "--no-session",
      "--no-context-files",
      "--no-skills",
      "--thinking", thinking,
      "--mode", "json",
    ];
    if (tools?.length) args.push("--tools", tools.join(","));
    args.push("-p", prompt);

    const proc = spawn("pi", args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    proc.stdout.on("data", (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          parseJsonEvents(line, widgetState, textAcc, errAcc, usageAcc);
          onUpdate();
        }
      }
    });

    proc.on("close", (code) => {
      if (lineBuffer.trim()) parseJsonEvents(lineBuffer, widgetState, textAcc, errAcc, usageAcc);
      resolve({
        exitCode: code,
        fullText: textAcc.value.trim(),
        errorMessage: errAcc.value || undefined,
        usage: usageAcc,
      });
    });

    signal.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  });
}
