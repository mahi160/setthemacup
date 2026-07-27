/**
 * fast-commands.ts — deterministic slash commands (/commit /pr /pr-check
 * /standup /review /test) that each run one dedicated custom agent (see
 * ../agents/*.md) through pi-subagents' public v1 delegation API.
 *
 * pi-subagents owns discovery, isolated launch, progress, and cost tracking —
 * this file only registers short command names and shows the result.
 * Bracket override matches /run's own convention: /commit [model=...] extra text
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { notify } from "./shared/notify.js";

const REQUEST_EVENT = "prompt-template:subagent:request";
const RESPONSE_EVENT = "prompt-template:subagent:response";
const TIMEOUT_MS = 5 * 60_000;

interface FastCommand {
  name: string;
  agent: string; // agent .md name in ../agents/
  description: string;
  output: "notify" | "inline"; // notify = toast only, inline = render full markdown
}

const COMMANDS: FastCommand[] = [
  { name: "commit", agent: "commit", output: "notify", description: "Generate and apply a conventional commit" },
  { name: "pr", agent: "pr", output: "inline", description: "Create a pull request" },
  { name: "pr-check", agent: "pr-check", output: "inline", description: "Line-by-line senior-dev review of a PR, posts inline GitHub comments" },
  { name: "standup", agent: "standup", output: "inline", description: "Generate daily standup from git activity" },
  { name: "review", agent: "review", output: "inline", description: "Two-axis review (Standards + Spec) of changes since a fixed point" },
  { name: "test", agent: "test", output: "inline", description: "Write tests for a file or function" },
];

interface DelegationResponse {
  requestId: string;
  status: string;
  error?: string;
  output?: string;
}

// ── Delegate to pi-subagents (prompt-template:subagent:* event contract) ────

function delegate(
  pi: ExtensionAPI,
  agent: string,
  task: string,
  cwd: string,
  model?: string,
): Promise<DelegationResponse> {
  const requestId = randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve({ requestId, status: "failed", error: "timed out waiting for subagent" });
    }, TIMEOUT_MS);

    const unsubscribe = pi.events.on(RESPONSE_EVENT, (payload: unknown) => {
      const res = payload as DelegationResponse;
      if (res.requestId !== requestId) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(res);
    });

    pi.events.emit(REQUEST_EVENT, {
      version: 1,
      requestId,
      agent,
      task,
      context: "fresh",
      cwd,
      timeoutMs: TIMEOUT_MS,
      ...(model ? { model } : {}),
    });
  });
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

// ── Display ──────────────────────────────────────────────────────────────────

function display(
  pi: ExtensionAPI,
  cmd: FastCommand,
  res: DelegationResponse,
  ctx: ExtensionCommandContext,
): void {
  if (res.status !== "completed") {
    const msg = (res.error ?? `agent ${res.status}`).slice(0, 160);
    ctx.ui.notify(`✗ /${cmd.name} failed: ${msg}`, "error");
    notify({ title: `π ✗ /${cmd.name}`, subtitle: "fast command failed", body: msg, sound: "error" });
    return;
  }

  const text = (res.output ?? "").trim();
  if (!text) {
    ctx.ui.notify(`/${cmd.name}: no output`, "warning");
    return;
  }

  if (cmd.output === "inline") {
    pi.sendMessage(
      { customType: "fast-command-result", content: "", display: true, details: { name: cmd.name, text } },
      { triggerTurn: false },
    );
  } else {
    const tail = text.split("\n").map((l) => l.trim()).filter(Boolean).at(-1) ?? "";
    ctx.ui.notify(`✓ /${cmd.name}${tail ? `: ${tail.slice(0, 120)}` : ""}`, "success");
  }

  const preview = text.split("\n").find((l) => l.trim()) ?? "Done";
  notify({ title: `π ✓ /${cmd.name}`, subtitle: "fast command", body: preview.slice(0, 100), sound: "success" });
}

// ── Extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  pi.registerMessageRenderer("fast-command-result", (message, _opts, theme) => {
    const { name, text } = message.details as { name: string; text: string };
    const header = theme.fg("success", ` /${name}`);
    const md = new Markdown(text, 1, 0, getMarkdownTheme());
    return {
      render: (width: number) => [header, "", ...md.render(width)],
      invalidate: () => md.invalidate(),
    };
  });

  const inFlight = new Set<string>();

  for (const cmd of COMMANDS) {
    pi.registerCommand(cmd.name, {
      description: cmd.description,
      handler: async (args, ctx) => {
        if (inFlight.has(cmd.name)) {
          ctx.ui.notify(`/${cmd.name} is already running — wait for it`, "warning");
          return;
        }
        inFlight.add(cmd.name);
        try {
          await ctx.waitForIdle();
          const { model, task } = parseArgs(args);
          const finalTask = task
            ? `IMPORTANT — user instruction (follow this, it overrides the defaults above where they conflict): ${task}`
            : "";
          const res = await delegate(pi, cmd.agent, finalTask, ctx.cwd ?? process.cwd(), model);
          display(pi, cmd, res, ctx);
        } finally {
          inFlight.delete(cmd.name);
        }
      },
    });
  }
}
