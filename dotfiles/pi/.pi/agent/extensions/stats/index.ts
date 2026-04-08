import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createInputRecord,
  finalizeInputRecord,
  finalizeSession,
  getDailyStats,
  getOverallStats,
  getRecentSessions,
  getTopModelsByInputs,
  getTopProjects,
  getTopToolsByInputs,
  getWeeklyStats,
  upsertSession,
} from "./db.js";
import { buildHtmlDashboard } from "./html.js";
import { renderStats, STATS_CONFIG } from "./render.js";

/* ─── types ───────────────────────────────────────────────────────────────── */

interface SessionState {
  id: string;
  startedAt: number;
  turns: number;
  tokens: number;
  tools: Map<string, number>;
  commands: Map<string, number>;
  skills: Map<string, number>;
  models: Array<{ provider: string; modelId: string; selectedAt: number }>;
}

interface InputState {
  id: string;
  sessionId: string;
  startedAt: number;
  startTokens: number;
  provider: string;
  modelId: string;
  costPerMTokenIn: number;
  costPerMTokenOut: number;
  tools: Map<string, number>;
  commands: Map<string, number>;
  skills: Map<string, number>;
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function weekRange(): { start: number; end: number } {
  const end = Date.now();
  return { start: end - STATS_CONFIG.weekDays * 86_400_000, end };
}

function parseInputPrefix(text: string): {
  skills: Map<string, number>;
  commands: Map<string, number>;
} {
  const skills = new Map<string, number>();
  const commands = new Map<string, number>();
  const trimmed = text.trim();
  if (trimmed.startsWith("/skill:")) {
    const name = trimmed.slice(7).split(" ")[0] ?? "";
    if (name) inc(skills, name);
  } else if (trimmed.startsWith("/")) {
    const name = trimmed.slice(1).split(" ")[0] ?? "";
    if (name) inc(commands, name);
  }
  return { skills, commands };
}

/* ─── extension ───────────────────────────────────────────────────────────── */

export default function (pi: ExtensionAPI) {
  let session: SessionState | null = null;
  let currentInput: InputState | null = null;

  /* ── session lifecycle ──────────────────────────────────────────────────── */

  pi.on("session_start", (_, ctx: ExtensionContext) => {
    const id = ctx.sessionManager.getSessionFile() ?? randomUUID();
    const now = Date.now();
    session = {
      id,
      startedAt: now,
      turns: 0,
      tokens: 0,
      tools: new Map(),
      commands: new Map(),
      skills: new Map(),
      models: ctx.model
        ? [
            {
              provider: ctx.model.provider,
              modelId: ctx.model.id,
              selectedAt: now,
            },
          ]
        : [],
    };
    upsertSession(id, now, ctx.cwd ?? "");
  });

  pi.on("model_select", (event) => {
    session?.models.push({
      provider: event.model.provider,
      modelId: event.model.id,
      selectedAt: Date.now(),
    });
  });

  /* ── per-input lifecycle ────────────────────────────────────────────────── */

  pi.on("before_agent_start", (event, ctx: ExtensionContext) => {
    if (!session) return;
    currentInput = null;

    const { skills, commands } = parseInputPrefix(event.prompt ?? "");

    currentInput = {
      id: randomUUID(),
      sessionId: session.id,
      startedAt: Date.now(),
      startTokens: session.tokens,
      provider: ctx.model?.provider ?? "unknown",
      modelId: ctx.model?.id ?? "unknown",
      costPerMTokenIn: ctx.model?.cost.input ?? 0,
      costPerMTokenOut: ctx.model?.cost.output ?? 0,
      tools: new Map(),
      commands,
      skills,
    };

    createInputRecord({
      id: currentInput.id,
      sessionId: currentInput.sessionId,
      startedAt: currentInput.startedAt,
      provider: currentInput.provider,
      modelId: currentInput.modelId,
    });
  });

  pi.on("tool_execution_start", (event) => {
    if (session) inc(session.tools, event.toolName);
    if (currentInput) inc(currentInput.tools, event.toolName);
  });

  pi.on("turn_end", (_, ctx: ExtensionContext) => {
    if (!session) return;
    session.turns++;
    const usage = ctx.getContextUsage();
    if (usage?.tokens) session.tokens = usage.tokens;
  });

  pi.on("agent_end", () => {
    if (!currentInput || !session) return;

    const endedAt = Date.now();
    const timeMs = endedAt - currentInput.startedAt;
    const tokenDelta = Math.max(0, session.tokens - currentInput.startTokens);
    const avgCost =
      (currentInput.costPerMTokenIn + currentInput.costPerMTokenOut) / 2;

    finalizeInputRecord(
      currentInput.id,
      endedAt,
      timeMs,
      tokenDelta,
      currentInput.tools,
      currentInput.commands,
      currentInput.skills,
      (tokenDelta / 1_000_000) * avgCost,
    );
    currentInput = null;
  });

  /* ── session-level command tracking ─────────────────────────────────────── */

  pi.on("input", (event) => {
    if (!session) return;
    const text = event.text.trim();
    if (text.startsWith("/skill:")) {
      inc(session.skills, text.slice(7).split(" ")[0] ?? "");
    } else if (text.startsWith("/")) {
      inc(session.commands, text.slice(1).split(" ")[0] ?? "");
    }
  });

  /* ── session shutdown ───────────────────────────────────────────────────── */

  pi.on("session_shutdown", (_, ctx: ExtensionContext) => {
    if (!session) return;
    currentInput = null;

    const lastModel = session.models.at(-1);
    let cost = 0;
    if (lastModel && ctx.model) {
      cost =
        (session.tokens / 1_000_000) *
        ((ctx.model.cost.input + ctx.model.cost.output) / 2);
    }

    finalizeSession(
      session.id,
      Date.now(),
      session.turns,
      session.tokens,
      cost,
      session.tools,
      session.commands,
      session.skills,
      session.models,
    );
    session = null;
  });

  /* ── /stat command ──────────────────────────────────────────────────────── */

  pi.registerCommand("stat", {
    description: "Show usage statistics dashboard (enter to open in browser)",
    handler: async (_, ctx: ExtensionContext) => {
      const { start, end } = weekRange();
      const overall = getOverallStats();
      const weekly = getWeeklyStats(start, end);
      const tools = getTopToolsByInputs(start, STATS_CONFIG.topToolsLimit);
      const models = getTopModelsByInputs(STATS_CONFIG.topModelsLimit);
      const projects = getTopProjects(STATS_CONFIG.topProjectsLimit);
      const daily = getDailyStats(STATS_CONFIG.tokenGraphDays);
      const recent = getRecentSessions(STATS_CONFIG.recentSessionsLimit);

      const html = buildHtmlDashboard(
        overall,
        weekly,
        tools,
        models,
        projects,
        daily,
        recent,
        start,
        end,
      );

      await ctx.ui.custom((_, __, ___, done) => {
        let cache: { width: number; lines: string[] } | null = null;

        return {
          render(width: number): string[] {
            if (cache?.width === width) return cache.lines;
            const lines = renderStats(
              overall,
              weekly,
              tools,
              models,
              projects,
              daily,
              recent,
              width,
              start,
            );
            cache = { width, lines };
            return lines;
          },
          invalidate() {
            cache = null;
          },
          handleInput(data: string) {
            if (matchesKey(data, "escape") || data === "q")
              return done(undefined);
            if (matchesKey(data, "enter")) {
              try {
                const path = join(tmpdir(), "pi-stats.html");
                writeFileSync(path, html, "utf8");
                execSync(`open "${path}"`, { stdio: "ignore" });
              } catch {
                /* ignore open errors */
              }
              done(undefined);
            }
          },
        };
      });
    },
  });
}
