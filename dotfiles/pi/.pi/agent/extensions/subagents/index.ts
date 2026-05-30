import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";
import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

interface SubagentModel {
  provider: string;
  id: string;
}

interface SubagentConfig {
  name: string;
  label: string;
  description: string;
  role: string;
  prompt: string | string[];
  promptGuidelines?: string[];
  thinking?: string;
  tools?: string[];
  maxOutputChars?: number;
  icon?: string;
}

interface Config {
  models: SubagentModel[];
  agents: SubagentConfig[];
}

interface JsonEvent {
  type: string;
  toolName?: string;
  args?: Record<string, unknown>;
  assistantMessageEvent?: { type: string; delta?: string };
}

interface WidgetState {
  spinnerFrame: number;
  elapsedMs: number;
  model: string;
  agent: string;
  icon: string;
  currentTool: string;
  toolCount: number;
  recentText: string[];
}

const configPath = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "subagents.json",
);
const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));

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

let cachedModel: SubagentModel | null | undefined;

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

function replaceAll(input: string, values: Record<string, string>): string {
  let result = input;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

function buildPrompt(
  agent: SubagentConfig,
  params: { task: string; paths?: string[]; maxFiles?: number },
): string {
  const body = Array.isArray(agent.prompt)
    ? agent.prompt.join("\n")
    : agent.prompt;
  return replaceAll(body, {
    task: params.task,
    paths: params.paths?.length ? params.paths.join(", ") : "none provided",
    maxFiles: String(params.maxFiles ?? 20),
  });
}

function formatTool(
  name: string | undefined,
  args: Record<string, unknown> | undefined,
): string {
  if (!name) return "";
  const n = name.toLowerCase();
  if (!args) return n;
  if (n === "bash" && typeof args.command === "string")
    return `bash: ${args.command.slice(0, 80)}`;
  if (
    (n === "read" || n === "write" || n === "edit") &&
    typeof args.path === "string"
  )
    return `${n}: ${args.path}`;
  if (n === "grep" && typeof args.pattern === "string")
    return `grep: ${args.pattern}`;
  if (n === "find" && typeof args.pattern === "string")
    return `find: ${args.pattern}`;
  if (n === "ls" && typeof args.path === "string") return `ls: ${args.path}`;
  return n;
}

function parseJsonLine(
  line: string,
  textAcc: { value: string },
  state: WidgetState,
  onUpdate?: (text: string) => void,
): void {
  let event: JsonEvent;
  try {
    event = JSON.parse(line) as JsonEvent;
  } catch {
    return;
  }

  if (event.type === "tool_execution_start") {
    state.currentTool = formatTool(event.toolName, event.args);
    onUpdate?.(`tool: ${state.currentTool || event.toolName || "unknown"}`);
    return;
  }

  if (event.type === "tool_execution_end") {
    state.currentTool = "";
    state.toolCount++;
    return;
  }

  const msg = event.assistantMessageEvent;
  if (
    event.type === "message_update" &&
    msg?.type === "text_delta" &&
    msg.delta
  ) {
    textAcc.value += msg.delta;
    state.recentText = textAcc.value
      .split("\n")
      .filter(Boolean)
      .slice(-12);
  }
}

function runSubagent(options: {
  model: SubagentModel;
  thinking: string;
  prompt: string;
  cwd: string;
  tools: string[];
  signal?: AbortSignal;
  state: WidgetState;
  onUpdate?: (text: string) => void;
  requestRender?: () => void;
}): Promise<{ exitCode: number | null; text: string; stderr: string }> {
  return new Promise((resolve) => {
    const textAcc = { value: "" };
    let stdoutBuffer = "";
    let stderr = "";

    const args = [
      "--model",
      `${options.model.provider}/${options.model.id}`,
      "--no-session",
      "--no-context-files",
      "--no-skills",
      "--thinking",
      options.thinking,
      "--mode",
      "json",
      "--tools",
      options.tools.join(","),
      "-p",
      options.prompt,
    ];

    const proc = spawn("pi", args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        parseJsonLine(line, textAcc, options.state, options.onUpdate);
        options.requestRender?.();
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (stdoutBuffer.trim())
        parseJsonLine(stdoutBuffer, textAcc, options.state, options.onUpdate);
      options.requestRender?.();
      resolve({
        exitCode: code,
        text: textAcc.value.trim(),
        stderr: stderr.trim(),
      });
    });

    options.signal?.addEventListener("abort", () => proc.kill("SIGTERM"), {
      once: true,
    });
  });
}

async function resolveModel(
  ctx: Pick<ExtensionContext, "modelRegistry">,
): Promise<SubagentModel | undefined> {
  if (cachedModel !== undefined) return cachedModel ?? undefined;

  for (const candidate of config.models) {
    const key = await ctx.modelRegistry.getApiKeyForProvider(
      candidate.provider,
    );
    if (key) {
      cachedModel = candidate;
      return candidate;
    }
  }

  cachedModel = config.models[0] ?? null;
  return cachedModel ?? undefined;
}

function installWidget(
  ctx: ExtensionContext,
  key: string,
  state: WidgetState,
): { requestRender(): void } | undefined {
  let widgetTui: { requestRender(): void } | undefined;

  ctx.ui.setWidget(
    key,
    (tui, theme) => {
      widgetTui = tui;
      return {
        render(width: number): string[] {
          const innerW = Math.max(0, width - 4);
          const spin = theme.fg(
            "warning",
            SPINNER_FRAMES[state.spinnerFrame % SPINNER_FRAMES.length]!,
          );
          const title = theme.fg("toolTitle", theme.bold(`${state.icon} Sub-agent`));
          const header =
            spin +
            theme.fg("dim", ` ${state.model}`) +
            theme.fg("muted", ` → ${state.agent}`) +
            theme.fg(
              "dim",
              ` · ${(state.elapsedMs / 1000).toFixed(1)}s · ${state.toolCount} tools`,
            );

          const lines = [title, header];
          if (state.currentTool)
            lines.push(
              theme.fg(
                "warning",
                `▸ ${truncateToWidth(state.currentTool, innerW - 2)}`,
              ),
            );
          for (const line of state.recentText)
            lines.push(theme.fg("dim", truncateToWidth(line, innerW)));
          if (!state.currentTool && state.recentText.length === 0)
            lines.push(theme.fg("dim", "⏳ starting..."));
          while (lines.length < 14) lines.push("");
          return bordered(lines.slice(0, 16), width, theme);
        },
        invalidate() {},
      };
    },
    { placement: "belowEditor" },
  );

  return { requestRender: () => widgetTui?.requestRender() };
}

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", () => {
    cachedModel = undefined;
  });

  for (const agent of config.agents) {
    pi.registerTool({
      name: agent.name,
      label: agent.label,
      description: agent.description,
      promptSnippet: agent.description,
      promptGuidelines: agent.promptGuidelines,
      parameters: Type.Object({
        task: Type.String({
          description:
            "Specific codebase question or repo context to gather for the main model",
        }),
        paths: Type.Optional(
          Type.Array(Type.String(), {
            description: "Optional path/file hints to focus exploration",
          }),
        ),
        maxFiles: Type.Optional(
          Type.Number({
            description: "Max relevant files to report. Default 20",
          }),
        ),
      }),
      async execute(toolCallId, params, signal, _onUpdate, ctx) {
        const model = await resolveModel(ctx);
        if (!model) {
          return {
            isError: true,
            content: [{ type: "text", text: "No subagent model configured." }],
          };
        }

        const tools = agent.tools ?? ["read", "grep", "find", "ls"];
        const state: WidgetState = {
          spinnerFrame: 0,
          elapsedMs: 0,
          model: `${model.provider}/${model.id}`,
          agent: agent.label,
          icon: agent.icon ?? "󰚩",
          currentTool: "",
          toolCount: 0,
          recentText: [],
        };
        const widgetKey = `subagent-${toolCallId}`;
        const widget = installWidget(ctx, widgetKey, state);
        let spinnerTimer: ReturnType<typeof setInterval> | undefined;

        try {
          spinnerTimer = setInterval(() => {
            state.spinnerFrame =
              (state.spinnerFrame + 1) % SPINNER_FRAMES.length;
            state.elapsedMs += 100;
            widget?.requestRender();
          }, 100);

          const result = await runSubagent({
            model,
            thinking: agent.thinking ?? "low",
            prompt: buildPrompt(agent, params),
            cwd: ctx.cwd,
            tools,
            signal,
            state,
            requestRender: () => widget?.requestRender(),
          });

          const max = agent.maxOutputChars ?? 20000;
          const text =
            result.text.length > max
              ? `${result.text.slice(0, max)}\n\n[truncated]`
              : result.text;

          if (result.exitCode !== 0) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text:
                    text ||
                    result.stderr ||
                    `${agent.name} failed with exit ${result.exitCode}`,
                },
              ],
              details: {
                exitCode: result.exitCode,
                stderr: result.stderr,
                model,
                tools,
              },
            };
          }

          return {
            content: [{ type: "text", text }],
            details: { model, tools },
          };
        } finally {
          clearInterval(spinnerTimer);
          ctx.ui.setWidget(widgetKey, undefined);
        }
      },
    });
  }
}
