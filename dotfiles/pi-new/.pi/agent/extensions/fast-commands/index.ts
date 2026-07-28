/**
 * fast-commands/index.ts — ONE self-owned subagent mechanism, not two.
 *
 * Auto-discovers every ../../agents/*.md. Agents with `command: true`
 * (commit/pr/pr-check/standup/review/test) also get a slash command. Every
 * agent — command or not (e.g. worker) — is dispatchable through the single
 * `subagent` tool, which the main model can call directly. Slash commands
 * and the tool call the exact same dispatch() function: no event bridge, no
 * second parallel mechanism. Retires `pi-subagents` for this repo entirely —
 * see docs/adr/0001-self-owned-fast-commands.md and its follow-up decision.
 *
 * Bracket override on slash commands: /commit [model=...] extra text
 */

import { readFileSync, readdirSync } from "node:fs";
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
import { notify } from "../shared/notify.ts";
import { parseAgentFile, type LoadedAgent } from "./frontmatter.ts";
import { spawnCleanSession, bordered, SPINNER_FRAMES, type WidgetState } from "./spawn-subagent.ts";

const agentsDir = fileURLToPath(new URL("../../agents/", import.meta.url));

function load(): LoadedAgent[] {
  return readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseAgentFile(readFileSync(join(agentsDir, f), "utf-8"), f.replace(/\.md$/, "")));
}

// Root-caused the "/commit just asks instead of committing" bug: a vague
// default task ("proceed with your default instructions") invited the model
// to ramble a clarifying question as its whole final answer instead of
// acting. This suffix forbids that, while keeping a real escape hatch for
// genuine ambiguity via the ASK: sentinel (caught by runInteractive below).
const ASK_HINT =
  "\n\n---\nDecide from the rules above and act — do not ask a clarifying question. " +
  "If something is genuinely ambiguous with no reasonable default, output ONLY " +
  "`ASK: <your question>` as your entire final message (nothing else); you'll get " +
  "the answer back and can continue. If truly blocked (e.g. nothing staged), say so " +
  "in one line and stop — don't ask what to do next.";

const MAX_ASKS = 3;

let agents: LoadedAgent[] = [];
try {
  agents = load();
} catch (err) {
  console.warn("[fast-commands] failed to load agents:", err);
}
const agentByName = new Map(agents.map((a) => [a.name, a]));

// ── Widget + spawn ─────────────────────────────────────────────────────────────

type AnyCtx = ExtensionCommandContext | ExtensionContext;

let widgetSeq = 0;

// Debounce widget redraws — tool-call bursts + the 100ms tick can both fire
// requestRender() within a few ms of each other; coalesce to ~1 render/50ms.
const pendingRender = new WeakSet<object>();
function scheduleRender(tui: { requestRender(): void } | undefined): void {
  if (!tui || pendingRender.has(tui)) return;
  pendingRender.add(tui);
  setTimeout(() => {
    pendingRender.delete(tui);
    tui.requestRender();
  }, 50);
}

async function run(
  agent: LoadedAgent,
  prompt: string,
  signal: AbortSignal,
  ctx: AnyCtx,
): Promise<{ exitCode: number | null; text: string }> {
  const widgetState: WidgetState & { name: string; icon: string; modelId: string } = {
    spinnerFrame: 0,
    elapsedMs: 0,
    currentTool: "",
    toolCount: 0,
    recentText: [],
    retrying: false,
    retryAttempt: 0,
    name: agent.name,
    icon: agent.icon,
    modelId: agent.model.split("/")[1] ?? agent.model,
  };

  const widgetKey = `fast-command-${agent.name}-${Date.now()}-${widgetSeq++}`;
  let widgetTui: { requestRender(): void } | undefined;

  ctx.ui.setWidget(
    widgetKey,
    (tui, theme) => {
      widgetTui = tui;
      return {
        render(width: number): string[] {
          const spin = theme.fg("warning", SPINNER_FRAMES[widgetState.spinnerFrame % SPINNER_FRAMES.length]!);
          const elapsed = theme.fg("dim", ` ${(widgetState.elapsedMs / 1000).toFixed(1)}s`);
          const header =
            spin +
            theme.fg("success", ` ${widgetState.icon} ${widgetState.name}`) +
            theme.fg("muted", ` · ${widgetState.modelId}`) +
            elapsed;

          const lines: string[] = [header];
          if (widgetState.retrying) {
            lines.push(theme.fg("warning", `  ↻ retry ${widgetState.retryAttempt}...`));
          } else if (widgetState.currentTool) {
            const iw = Math.max(0, width - 8);
            lines.push(theme.fg("warning", "  ▸") + theme.fg("dim", ` ${widgetState.currentTool.slice(0, iw)}`));
          } else {
            lines.push(theme.fg("dim", "  ⏳ processing..."));
          }
          if (widgetState.toolCount > 0) {
            lines.push(theme.fg("muted", `  ${widgetState.toolCount} tool${widgetState.toolCount !== 1 ? "s" : ""} used`));
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
    widgetState.spinnerFrame = (widgetState.spinnerFrame + 1) % SPINNER_FRAMES.length;
    widgetState.elapsedMs += 100;
    scheduleRender(widgetTui);
  }, 100);

  try {
    const { exitCode, fullText, errorMessage } = await spawnCleanSession(
      agent.model,
      agent.thinking,
      prompt,
      signal,
      widgetState,
      () => scheduleRender(widgetTui),
      agent.tools,
    );
    // pi exits 0 even on API errors — if no text but an error was captured, surface it
    if (!fullText && errorMessage) return { exitCode: 1, text: errorMessage };
    return { exitCode, text: fullText };
  } finally {
    clearInterval(timer);
    ctx.ui.setWidget(widgetKey, undefined);
  }
}

// Runs an agent; if it asks a question (ASK: convention), surfaces it via
// ctx.ui.input (native prompt primitive — no custom overlay component
// needed), then re-runs with the answer appended.
async function runInteractive(
  agent: LoadedAgent,
  initialPrompt: string,
  signal: AbortSignal,
  ctx: AnyCtx,
): Promise<{ exitCode: number | null; text: string }> {
  let prompt = initialPrompt;
  for (let attempt = 0; attempt <= MAX_ASKS; attempt++) {
    const result = await run(agent, prompt, signal, ctx);
    const match = result.exitCode === 0 ? result.text.trim().match(/^ASK:\s*([\s\S]+)$/i) : null;
    if (!match || attempt === MAX_ASKS) return result;

    const question = match[1]!.trim();
    let answer: string | null | undefined;
    try {
      answer = await ctx.ui.input(question, "Type your answer...");
    } catch {
      return result; // no interactive UI available (e.g. headless) — surface the ASK as-is
    }
    if (!answer) return result; // user cancelled

    prompt = `${initialPrompt}\n\nYou previously asked: "${question}"\nUser answered: "${answer}"\nContinue the task using this answer — do not ask the same thing again.`;
  }
  return { exitCode: 1, text: "agent asked too many questions — aborted" };
}

// ── Shared dispatch — the one thing both slash commands and the tool call ──

interface DispatchResult {
  exitCode: number | null;
  text: string;
}

async function dispatch(
  agentName: string,
  task: string,
  signal: AbortSignal,
  ctx: AnyCtx,
  modelOverride?: string,
): Promise<DispatchResult> {
  const agent = agentByName.get(agentName);
  if (!agent) {
    return {
      exitCode: 1,
      text: `Unknown agent "${agentName}". Available: ${[...agentByName.keys()].join(", ")}`,
    };
  }
  const prompt = agent.prompt + ASK_HINT + (task ? `\n\nTask: ${task}` : "");
  return runInteractive(modelOverride ? { ...agent, model: modelOverride } : agent, prompt, signal, ctx);
}

// ── Display (slash commands only — tool results go straight back to the model) ──

function display(pi: ExtensionAPI, agent: LoadedAgent, result: DispatchResult, ctx: ExtensionCommandContext): void {
  const { exitCode, text } = result;

  if (exitCode !== 0) {
    const tail = text.split("\n").map((l) => l.trim()).filter(Boolean).at(-1) ?? "";
    ctx.ui.notify(`✗ /${agent.name} failed${tail ? `: ${tail.slice(0, 120)}` : ` (exit ${exitCode})`}`, "error");
    notify({ title: `π ✗ /${agent.name}`, subtitle: "fast command failed", body: tail.slice(0, 100) || `exit ${exitCode}`, sound: "error" });
    return;
  }

  if (!text.trim()) {
    ctx.ui.notify(`/${agent.name}: no output`, "warning");
    return;
  }

  if (agent.output === "inline") {
    pi.sendMessage(
      { customType: "fast-command-result", content: "", display: true, details: { name: agent.name, icon: agent.icon, text } },
      { triggerTurn: false },
    );
  } else {
    const tail = text.split("\n").map((l) => l.trim()).filter(Boolean).at(-1) ?? "";
    ctx.ui.notify(`✓ /${agent.name}${tail ? `: ${tail.slice(0, 120)}` : ""}`, "success");
  }

  const preview = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 2).join(" · ");
  notify({ title: `π ✓ /${agent.name}`, subtitle: agent.description, body: preview.slice(0, 100) || "Done", sound: "success" });
}

// ── Bracket override: /commit [model=anthropic/claude-opus-5] extra text ───

function parseArgs(args: string): { model?: string; task: string } {
  const trimmed = args.trim();
  const match = trimmed.match(/^\[([^\]]*)\]\s*/);
  if (!match) return { task: trimmed };
  const config: Record<string, string> = {};
  for (const part of match[1]!.split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k && v) config[k] = v;
  }
  return { model: config.model, task: trimmed.slice(match[0].length).trim() };
}

// ── Extension ──────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  pi.registerMessageRenderer("fast-command-result", (message, _opts, theme) => {
    const { name, icon, text } = message.details as { name: string; icon: string; text: string };
    const header = theme.fg("success", ` ${icon}  /${name}`);
    const md = new Markdown(text, 1, 0, getMarkdownTheme());
    return {
      render: (width: number) => [header, "", ...md.render(width)],
      invalidate: () => md.invalidate(),
    };
  });

  // Concurrency guard for slash commands only — prevents double-triggering the
  // same personal command (e.g. mashing /commit). Tool calls from the main
  // model (below) run unguarded so genuinely parallel dispatch (e.g. two
  // review agents fired in one turn) isn't serialized behind this.
  const inFlight = new Set<string>();

  const commandAgents = agents.filter((a) => a.command);
  for (const agent of commandAgents) {
    pi.registerCommand(agent.name, {
      description: agent.description,
      handler: async (args, ctx) => {
        if (inFlight.has(agent.name)) {
          ctx.ui.notify(`/${agent.name} is already running — wait for it`, "warning");
          return;
        }
        inFlight.add(agent.name);
        try {
          await ctx.waitForIdle();
          const { model, task } = parseArgs(args);
          const abort = new AbortController();
          const result = task
            ? await dispatch(
                agent.name,
                `IMPORTANT — user instruction (follow this, it overrides the defaults above where they conflict): ${task}`,
                abort.signal,
                ctx,
                model,
              )
            : await dispatch(agent.name, "", abort.signal, ctx, model);
          display(pi, agent, result, ctx);
        } finally {
          inFlight.delete(agent.name);
        }
      },
    });
  }

  // ── Generic `subagent` tool — the same dispatch(), callable by the main model ──

  const roster = agents.map((a) => `${a.name} — ${a.description}`).join("; ");

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: `Dispatch a named agent with a free-form task. Available agents: ${roster}`,
    promptSnippet: `Dispatch a named agent for research, review, or implementation work not worth doing inline. Available agents: ${roster}`,
    parameters: Type.Object({
      agent: Type.String({ description: `Agent name. Available: ${[...agentByName.keys()].join(", ")}` }),
      task: Type.String({ description: "Specific task for this agent" }),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      const result = await dispatch(params.agent, params.task, signal, ctx);
      if (result.exitCode === 0) return { content: [{ type: "text", text: result.text || "(no output)" }] };
      return { isError: true, content: [{ type: "text", text: result.text || `Agent exited ${result.exitCode}` }] };
    },
  });

  console.log(
    `[fast-commands] ${commandAgents.length} commands (${commandAgents.map((a) => `/${a.name}`).join(", ")}), ` +
      `${agents.length} agents dispatchable via subagent tool`,
  );
}
