/**
 * agents/index.ts — Unified subagent extension.
 *
 * Loads agents.json. For each agent:
 *   type:"user" → registers as a slash command  (/commit, /standup, etc.)
 *   type:"ai"   → registers as an LLM-callable tool (scout, diff_review, etc.)
 *
 * Also registers:
 *   /sub <name> <task>  — run any agent with a free-form task
 *   custom_agent tool   — same as /sub but callable by the main LLM
 *
 * Subprocess flags: --no-session --no-extensions --no-context-files --no-skills
 * so subagents are fully isolated (no budget-guard, no context bleed).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Markdown } from "@earendil-works/pi-tui";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  spawnCleanSession,
  bordered,
  SPINNER_FRAMES,
  type WidgetState,
} from "../shared/spawn-subagent";
import { notifyMacOS } from "../shared/macOS-notify";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentDef {
  name: string;
  label: string;
  icon: string;
  type: "user" | "ai";
  output?: "notify" | "inline"; // user-type only
  model: string; // "provider/model-id"
  thinking: string;
  tools: string[];
  file: string; // relative to config dir
  description: string;
  guidelines?: string[]; // ai-type only: injected into main agent system prompt
}

interface LoadedAgent extends AgentDef {
  prompt: string;
}

// ── Load config ────────────────────────────────────────────────────────────────

const configDir = join(fileURLToPath(new URL(".", import.meta.url)), "config");

function load(): LoadedAgent[] {
  const raw = JSON.parse(
    readFileSync(join(configDir, "agents.json"), "utf-8"),
  ) as { agents: AgentDef[] };

  return raw.agents.map((def) => {
    const filePath = join(configDir, def.file);
    const prompt = existsSync(filePath)
      ? readFileSync(filePath, "utf-8").trim()
      : "";
    if (!prompt) console.warn(`[agents] prompt file missing: ${filePath}`);
    return { ...def, prompt };
  });
}

let agents: LoadedAgent[] = [];
try {
  agents = load();
} catch (err) {
  console.warn("[agents] failed to load config:", err);
}

// ── Widget + spawn ─────────────────────────────────────────────────────────────

type AnyCtx = ExtensionCommandContext | ExtensionContext;

async function run(
  agent: LoadedAgent,
  prompt: string,
  signal: AbortSignal,
  ctx: AnyCtx,
): Promise<{ exitCode: number | null; text: string }> {
  const widgetState: WidgetState & {
    label: string;
    icon: string;
    modelId: string;
  } = {
    spinnerFrame: 0,
    elapsedMs: 0,
    currentTool: "",
    toolCount: 0,
    recentText: [],
    retrying: false,
    retryAttempt: 0,
    label: agent.label,
    icon: agent.icon || "󰚩",
    modelId: agent.model.split("/")[1] ?? agent.model,
  };

  const widgetKey = `agent-${agent.name}-${Date.now()}`;
  let widgetTui: { requestRender(): void } | undefined;

  ctx.ui.setWidget(
    widgetKey,
    (tui, theme) => {
      widgetTui = tui;
      return {
        render(width: number): string[] {
          const iw = Math.max(0, width - 4);
          const spin = theme.fg(
            "warning",
            SPINNER_FRAMES[widgetState.spinnerFrame % SPINNER_FRAMES.length]!,
          );
          const elapsed = theme.fg(
            "dim",
            ` ${(widgetState.elapsedMs / 1000).toFixed(1)}s`,
          );
          const header =
            spin +
            theme.fg("success", ` ${widgetState.icon} ${widgetState.label}`) +
            theme.fg("muted", ` · ${widgetState.modelId}`) +
            elapsed;

          const lines: string[] = [header];
          if (widgetState.retrying) {
            lines.push(
              theme.fg("warning", `  ↻ retry ${widgetState.retryAttempt}...`),
            );
          } else if (widgetState.currentTool) {
            lines.push(
              theme.fg("warning", "  ▸") +
                theme.fg("dim", ` ${widgetState.currentTool.slice(0, iw - 4)}`),
            );
          } else {
            lines.push(theme.fg("dim", "  ⏳ processing..."));
          }
          if (widgetState.toolCount > 0) {
            lines.push(
              theme.fg(
                "muted",
                `  ${widgetState.toolCount} tool${widgetState.toolCount !== 1 ? "s" : ""} used`,
              ),
            );
          }
          while (lines.length < 4) lines.push("");
          return bordered(lines, width, theme);
        },
        invalidate() {},
      };
    },
    { placement: "belowEditor" },
  );

  const timer = setInterval(() => {
    widgetState.spinnerFrame =
      (widgetState.spinnerFrame + 1) % SPINNER_FRAMES.length;
    widgetState.elapsedMs += 100;
    widgetTui?.requestRender();
  }, 100);

  try {
    const { exitCode, fullText, errorMessage } = await spawnCleanSession(
      agent.model,
      agent.thinking,
      prompt,
      signal,
      widgetState,
      () => widgetTui?.requestRender(),
      agent.tools,
    );
    // pi exits 0 even on API errors — if no text but an error was captured, surface it
    if (!fullText && errorMessage) {
      return { exitCode: 1, text: errorMessage };
    }
    return { exitCode, text: fullText };
  } finally {
    clearInterval(timer);
    ctx.ui.setWidget(widgetKey, undefined);
  }
}

// ── Display (user commands) ────────────────────────────────────────────────────

function display(
  pi: ExtensionAPI,
  agent: LoadedAgent,
  result: { exitCode: number | null; text: string },
  ctx: ExtensionCommandContext,
): void {
  const { exitCode, text } = result;

  if (exitCode !== 0) {
    const tail =
      text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .at(-1) ?? "";
    ctx.ui.notify(
      `✗ /${agent.name} failed${tail ? `: ${tail.slice(0, 120)}` : ` (exit ${exitCode})`}`,
      "error",
    );
    notifyMacOS(`${agent.icon}  ✗ /${agent.name}`, "Agent failed", tail.slice(0, 100) || `exit ${exitCode}`, "Basso");
    return;
  }

  if (!text.trim()) {
    ctx.ui.notify(`/${agent.name}: no output`, "warning");
    return;
  }

  if (agent.output === "inline") {
    pi.sendMessage(
      {
        customType: "agent-result",
        content: "",
        display: true,
        details: { label: agent.label, icon: agent.icon, text },
      },
      { triggerTurn: false },
    );
  } else {
    // "notify" — show last meaningful line as toast
    const tail =
      text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .at(-1) ?? "";
    ctx.ui.notify(
      `✓ /${agent.name}${tail ? `: ${tail.slice(0, 120)}` : ""}`,
      "success",
    );
  }

  // macOS banner on success
  const preview = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
  notifyMacOS(`${agent.icon}  /${agent.name}`, agent.label, preview.slice(0, 100) || "Done", "Hero");
}

// ── Build prompt for AI tools (replaces {task}/{paths}/{maxFiles}) ─────────────

function buildAiPrompt(
  agent: LoadedAgent,
  task: string,
  paths?: string[],
  maxFiles?: number,
): string {
  return agent.prompt
    .replaceAll("{task}", task)
    .replaceAll("{paths}", paths?.length ? paths.join(", ") : "none provided")
    .replaceAll("{maxFiles}", String(maxFiles ?? 20));
}

// ── Extension ──────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  // Inline result renderer
  pi.registerMessageRenderer("agent-result", (message, _opts, theme) => {
    const { label, icon, text } = message.details as {
      label: string;
      icon: string;
      text: string;
    };
    const header = theme.fg("success", ` ${icon}  ${label}`);
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

  // Concurrency guard for user commands
  let activeCommand = "";
  pi.on("session_start", () => {
    activeCommand = "";
  });
  pi.on("session_shutdown", () => {
    activeCommand = "";
  });

  const userAgents = agents.filter((a) => a.type === "user");
  const aiAgents = agents.filter((a) => a.type === "ai");

  // ── User commands (/commit, /standup, etc.) ──────────────────────────────────

  for (const agent of userAgents) {
    pi.registerCommand(agent.name, {
      description: agent.description,
      handler: async (_args, ctx) => {
        if (activeCommand) {
          ctx.ui.notify(
            `/${activeCommand} is already running — wait for it`,
            "warning",
          );
          return;
        }
        activeCommand = agent.name;
        try {
          await ctx.waitForIdle();
          const abort = new AbortController();
          const result = await run(agent, agent.prompt, abort.signal, ctx);
          display(pi, agent, result, ctx);
        } finally {
          activeCommand = "";
        }
      },
    });
  }

  // ── AI tools (scout, diff_review, etc.) ─────────────────────────────────────

  for (const agent of aiAgents) {
    pi.registerTool({
      name: agent.name,
      label: agent.label,
      description: agent.description,
      promptSnippet: agent.description,
      promptGuidelines: agent.guidelines,
      parameters: Type.Object({
        task: Type.String({ description: "Specific task for this agent" }),
        paths: Type.Optional(
          Type.Array(Type.String(), { description: "Paths to focus on" }),
        ),
        maxFiles: Type.Optional(
          Type.Number({
            description: "Max files/findings to return. Default 20",
          }),
        ),
      }),
      async execute(_id, params, signal, _onUpdate, ctx) {
        const prompt = buildAiPrompt(
          agent,
          params.task,
          params.paths,
          params.maxFiles,
        );
        const { exitCode, text } = await run(agent, prompt, signal, ctx);
        if (exitCode === 0) {
          return { content: [{ type: "text", text: text || "(no output)" }] };
        }
        return {
          isError: true,
          content: [{ type: "text", text: text || `Agent exited ${exitCode}` }],
        };
      },
    });
  }

  // ── /sub <name> <task> ───────────────────────────────────────────────────────

  pi.registerCommand("sub", {
    description: "Run any agent with a custom task. Usage: /sub <name> <task>",
    handler: async (args, ctx) => {
      const trimmed = args.trim();

      if (!trimmed) {
        const lines = agents.map(
          (a) =>
            `  ${a.icon}  ${a.name.padEnd(14)} [${a.type}]  ${a.description}`,
        );
        ctx.ui.notify(`Agents:\n${lines.join("\n")}`, "info");
        return;
      }

      const match = trimmed.match(/^(\S+)\s*(.*)$/s);
      const name = match?.[1] ?? "";
      const task = match?.[2]?.trim() ?? "";

      const agent = agents.find((a) => a.name === name);
      if (!agent) {
        ctx.ui.notify(
          `Unknown agent "${name}". Run /sub to list available agents.`,
          "error",
        );
        return;
      }
      if (!task) {
        ctx.ui.notify(`Usage: /sub ${name} <task>`, "warning");
        return;
      }

      if (activeCommand) {
        ctx.ui.notify(
          `/${activeCommand} is already running — wait for it`,
          "warning",
        );
        return;
      }
      activeCommand = `sub:${name}`;

      try {
        await ctx.waitForIdle();
        const abort = new AbortController();
        const prompt =
          agent.type === "ai"
            ? buildAiPrompt(agent, task)
            : `${agent.prompt}\n\nAdditional task: ${task}`;
        const result = await run(agent, prompt, abort.signal, ctx);
        display(pi, agent, result, ctx);
      } finally {
        activeCommand = "";
      }
    },
  });

  // ── custom_agent tool (LLM callable) ─────────────────────────────────────────

  pi.registerTool({
    name: "custom_agent",
    label: "Custom Agent",
    description:
      "Dispatch any named agent with a free-form task. Use for one-off tasks or agents not otherwise exposed as dedicated tools.",
    promptSnippet: "Dispatch a named agent with a free-form task",
    parameters: Type.Object({
      name: Type.String({ description: "Agent name (see /sub for list)" }),
      task: Type.String({ description: "Task description" }),
      paths: Type.Optional(
        Type.Array(Type.String(), { description: "Paths to focus on" }),
      ),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      const agent = agents.find((a) => a.name === params.name);
      if (!agent) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown agent "${params.name}". Available: ${agents.map((a) => a.name).join(", ")}`,
            },
          ],
        };
      }

      const prompt =
        agent.type === "ai"
          ? buildAiPrompt(agent, params.task, params.paths)
          : `${agent.prompt}\n\nAdditional task: ${params.task}`;

      const { exitCode, text } = await run(agent, prompt, signal, ctx);
      if (exitCode === 0) {
        return { content: [{ type: "text", text: text || "(no output)" }] };
      }
      return {
        isError: true,
        content: [{ type: "text", text: text || `Agent exited ${exitCode}` }],
      };
    },
  });

  console.log(
    `[agents] ${userAgents.length} user commands (${userAgents.map((a) => `/${a.name}`).join(", ")}), ` +
      `${aiAgents.length} AI tools (${aiAgents.map((a) => a.name).join(", ")})`,
  );
}
