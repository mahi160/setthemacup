import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  spawnCleanSession,
  buildMessage,
  bordered,
  SPINNER_FRAMES,
  type WidgetState,
  type SubagentConfig,
  type Model,
} from "../shared/spawn-subagent";

interface SubagentConfigExt extends SubagentConfig {
  promptGuidelines?: string[];
  maxOutputChars?: number;
}

interface Config {
  models: Model[];
  agents: SubagentConfigExt[];
}

interface WidgetStateExt extends WidgetState {
  model: string;
  agent: string;
  icon: string;
}

const configPath = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "subagents.json",
);
const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));

let cachedModel: Model | null | undefined;

// Helper: replace placeholders in prompt template
function replaceAll(input: string, values: Record<string, string>): string {
  let result = input;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

// Helper: build subagent prompt with task params (task, paths, maxFiles)
function buildPromptWithParams(
  agent: SubagentConfigExt,
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

async function resolveModel(
  ctx: Pick<ExtensionContext, "modelRegistry">,
): Promise<Model | undefined> {
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
  state: WidgetStateExt,
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
          
          // Title with agent icon
          const title = theme.fg("success", theme.bold(`${state.icon} ${state.agent}`));
          
          // Info line: spinner + model + elapsed + tool count
          const header =
            spin +
            theme.fg("dim", ` ${state.model}`) +
            theme.fg("muted", ` · ${(state.elapsedMs / 1000).toFixed(1)}s`) +
            (state.toolCount > 0
              ? theme.fg("dim", ` · ${state.toolCount} tool${state.toolCount !== 1 ? "s" : ""}`)
              : "");

          const lines = [title, header];
          
          // Current tool or idle state
          if (state.currentTool) {
            lines.push(
              theme.fg("warning", "  ▸") +
              theme.fg("dim", ` ${truncateToWidth(state.currentTool, innerW - 6)}`),
            );
          } else if (state.recentText.length === 0) {
            lines.push(theme.fg("dim", "  ⏳ processing..."));
          }
          
          // Recent output
          if (state.recentText.length > 0) {
            lines.push(theme.fg("dim", ""));
            for (const line of state.recentText)
              lines.push(theme.fg("dim", `  ${truncateToWidth(line, innerW - 4)}`));
          }
          
          while (lines.length < 8) lines.push("");
          return bordered(lines.slice(0, 14), width, theme);
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
        const state: WidgetStateExt = {
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

          const { exitCode, fullText } = await spawnCleanSession(
            `${model.provider}/${model.id}`,
            agent.thinking ?? "low",
            buildPromptWithParams(agent, params),
            signal,
            state,
            () => widget?.requestRender(),
            tools,
          );

          const max = agent.maxOutputChars ?? 20000;
          const text =
            fullText.length > max
              ? `${fullText.slice(0, max)}\n\n[truncated]`
              : fullText;

          if (exitCode !== 0) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: text || `${agent.name} failed with exit ${exitCode}`,
                },
              ],
              details: {
                exitCode,
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
