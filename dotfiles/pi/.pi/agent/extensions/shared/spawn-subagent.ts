/**
 * shared/spawn-subagent.ts — Common logic for spawning clean subagent sessions.
 *
 * Both fast-commands and subagents extensions use this to:
 * - Spawn ephemeral pi processes in JSON-stream mode
 * - Parse structured JSON events (tool execution, text deltas, retries)
 * - Track widget state (spinner, elapsed time, current tool, output)
 * - Format tool execution summaries
 * - Build agent prompts
 */

import { spawn } from "node:child_process";
import {
  visibleWidth,
  truncateToWidth,
  type Theme,
} from "@earendil-works/pi-tui";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Model {
  provider: string;
  id: string;
}

export interface SubagentConfig {
  name: string;
  label: string;
  description: string;
  role: string;
  prompt: string | string[];
  thinking?: string;
  tools?: string[];
  icon?: string;
}

export interface WidgetState {
  spinnerFrame: number;
  elapsedMs: number;
  currentTool: string;
  toolCount: number;
  recentText: string[];
  retrying: boolean;
  retryAttempt: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const SPINNER_FRAMES = [
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

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Wraps styled lines in a rounded box border.
 */
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

/**
 * Formats a tool invocation (name + args) into a concise string.
 *   bash  → "bash: git diff --cached"
 *   read  → "read: src/index.ts"
 *   grep  → "grep: pattern"
 */
export function formatTool(
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
 * Builds a prompt from agent config + task parameters.
 * Replaces {task}, {paths}, {maxFiles} placeholders.
 */
export function buildPromptWithParams(
  agent: SubagentConfig,
  params: { task: string; paths?: string[]; maxFiles?: number },
): string {
  const body = Array.isArray(agent.prompt) ? agent.prompt.join("\n") : agent.prompt;
  return `Role: ${agent.role}.\n\n${body
    .replaceAll("{task}", params.task)
    .replaceAll("{paths}", params.paths?.length ? params.paths.join(", ") : "none provided")
    .replaceAll("{maxFiles}", String(params.maxFiles ?? 20))}`;
}

/**
 * Resolves the first model the current environment has an API key for.
 * Falls back to models[0] if none found.
 */
export async function resolveModel(
  ctx: { modelRegistry: { getApiKeyForProvider(p: string): Promise<string | null | undefined> } },
  models: Model[],
): Promise<Model | undefined> {
  for (const candidate of models) {
    const key = await ctx.modelRegistry.getApiKeyForProvider(candidate.provider);
    if (key) return candidate;
  }
  return models[0];
}

/**
 * Resolves model with optional provider/id override string ("provider/id").
 * Falls back to resolveModel if override not found.
 */
export async function resolveModelWithOverride(
  ctx: { modelRegistry: { getApiKeyForProvider(p: string): Promise<string | null | undefined> } },
  models: Model[],
  override?: string,
): Promise<Model | undefined> {
  if (override) {
    const [provider, id] = override.split("/");
    if (provider && id) {
      const found = models.find((m) => m.provider === provider && m.id === id);
      if (found) return found;
    }
  }
  return resolveModel(ctx, models);
}

/**
 * Parses one JSONL event from `--mode json` output.
 * Updates widget state: tool execution, text deltas, retries.
 */
export function parseJsonEvents(
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
        // Cap at 10KB to prevent unbounded growth on large outputs
        if (textAcc.value.length > 10_000) textAcc.value = textAcc.value.slice(-10_000);
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
 * Spawns a clean pi session in JSON-stream mode.
 * Accumulates assistant text, parses structured events into widget state.
 * Returns exit code + full accumulated text.
 * Optional tools list for subagent tool access.
 */
export function spawnCleanSession(
  modelFlag: string,
  thinking: string,
  prompt: string,
  signal: AbortSignal,
  widgetState: WidgetState,
  onUpdate: () => void,
  tools?: string[],
): Promise<{ exitCode: number | null; fullText: string }> {
  return new Promise((resolve) => {
    const textAcc = { value: "" };
    let lineBuffer = "";

    const args = [
      "--model",
      modelFlag,
      "--no-session",
      "--no-context-files",
      "--no-skills",
      "--thinking",
      thinking,
      "--mode",
      "json",
    ];
    if (tools?.length) {
      args.push("--tools", tools.join(","));
    }
    args.push("-p", prompt);

    const proc = spawn(
      "pi",
      args,
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      },
    );

    proc.stdout.on("data", (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          parseJsonEvents(line, widgetState, textAcc);
          onUpdate();
        }
      }
    });

    proc.on("close", (code) => {
      if (lineBuffer.trim()) parseJsonEvents(lineBuffer, widgetState, textAcc);
      resolve({ exitCode: code, fullText: textAcc.value.trim() });
    });

    signal.addEventListener("abort", () => proc.kill("SIGTERM"), {
      once: true,
    });
  });
}

/**
 * Builds a pi prompt from an agent config.
 * Joins multi-line prompt arrays and prefixes with role.
 */
export function buildMessage(agent: SubagentConfig): string {
  const body = Array.isArray(agent.prompt)
    ? agent.prompt.join("\n")
    : agent.prompt;
  return `Role: ${agent.role}.\n\n${body}`;
}
