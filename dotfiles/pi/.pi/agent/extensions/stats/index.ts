import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
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

/* ─── session state ───────────────────────────────────────────────────────── */

interface SessionState {
  id:       string;
  startedAt: number;
  turns:    number;
  tokens:   number;
  tools:    Map<string, number>;
  commands: Map<string, number>;
  skills:   Map<string, number>;
  models:   Array<{ provider: string; modelId: string; selectedAt: number }>;
}

function freshSession(id: string, startedAt: number): SessionState {
  return {
    id, startedAt, turns: 0, tokens: 0,
    tools: new Map(), commands: new Map(), skills: new Map(), models: [],
  };
}

/* ─── per-input state ─────────────────────────────────────────────────────── */

interface InputState {
  id:               string;
  sessionId:        string;
  startedAt:        number;
  startTokens:      number;
  provider:         string;
  modelId:          string;
  costPerMTokenIn:  number;   // $/M input tokens
  costPerMTokenOut: number;   // $/M output tokens
  tools:    Map<string, number>;
  commands: Map<string, number>;
  skills:   Map<string, number>;
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function weekRange(now = Date.now()): { start: number; end: number } {
  // "week" = last N days, configurable via STATS_CONFIG.weekDays
  const end   = now;
  const start = now - STATS_CONFIG.weekDays * 24 * 60 * 60 * 1000;
  return { start, end };
}

/* ─── extension ────────────────────────────────────────────────────────────── */

export default function (pi: ExtensionAPI) {
  let session: SessionState | null = null;
  let currentInput: InputState | null = null;

  /* session lifecycle */

  pi.on("session_start", (_, c: ExtensionContext) => {
    const id = c.sessionManager.getSessionFile() ?? randomUUID();
    const now = Date.now();
    session = freshSession(id, now);
    upsertSession(id, now, c.cwd ?? "");

    if (c.model) {
      session.models.push({ provider: c.model.provider, modelId: c.model.id, selectedAt: now });
    }
  });

  pi.on("model_select", (event) => {
    if (!session) return;
    session.models.push({
      provider:   event.model.provider,
      modelId:    event.model.id,
      selectedAt: Date.now(),
    });
  });

  /* per-input lifecycle */

  pi.on("before_agent_start", (event, c: ExtensionContext) => {
    if (!session) return;

    // If there's somehow an orphaned input (shouldn't happen), drop it
    currentInput = null;

    const prompt = event.prompt?.trim() ?? "";
    const skills: Map<string, number>   = new Map();
    const commands: Map<string, number> = new Map();

    if (prompt.startsWith("/skill:")) {
      const skillName = prompt.slice(7).split(" ")[0] ?? "";
      if (skillName) inc(skills, skillName);
    } else if (prompt.startsWith("/")) {
      const cmdName = prompt.slice(1).split(" ")[0] ?? "";
      if (cmdName) inc(commands, cmdName);
    }

    currentInput = {
      id:               randomUUID(),
      sessionId:        session.id,
      startedAt:        Date.now(),
      startTokens:      session.tokens,
      provider:         c.model?.provider ?? "unknown",
      modelId:          c.model?.id       ?? "unknown",
      costPerMTokenIn:  c.model?.cost.input  ?? 0,
      costPerMTokenOut: c.model?.cost.output ?? 0,
      tools:    new Map(),
      commands,
      skills,
    };

    createInputRecord({
      id:        currentInput.id,
      sessionId: currentInput.sessionId,
      startedAt: currentInput.startedAt,
      provider:  currentInput.provider,
      modelId:   currentInput.modelId,
    });
  });

  pi.on("tool_execution_start", (event) => {
    if (session) inc(session.tools, event.toolName);
    if (currentInput) inc(currentInput.tools, event.toolName);
  });

  pi.on("turn_end", (_, c: ExtensionContext) => {
    if (!session) return;
    session.turns++;
    const usage = c.getContextUsage();
    if (usage?.tokens) session.tokens = usage.tokens;
  });

  pi.on("agent_end", (_event, _c: ExtensionContext) => {
    if (!currentInput || !session) return;

    const endedAt    = Date.now();
    const timeMs     = endedAt - currentInput.startedAt;
    const tokenDelta = Math.max(0, session.tokens - currentInput.startTokens);
    const avgCost    = (currentInput.costPerMTokenIn + currentInput.costPerMTokenOut) / 2;
    const costUsd    = (tokenDelta / 1_000_000) * avgCost;

    finalizeInputRecord(
      currentInput.id,
      endedAt,
      timeMs,
      tokenDelta,
      currentInput.tools,
      currentInput.commands,
      currentInput.skills,
      costUsd,
    );

    currentInput = null;
  });

  /* session commands (not agent inputs — tracked at session level only) */

  pi.on("input", (event) => {
    if (!session) return;
    const text = event.text.trim();
    if (text.startsWith("/skill:")) {
      inc(session.skills, text.slice(7).split(" ")[0] ?? "");
    } else if (text.startsWith("/")) {
      inc(session.commands, text.slice(1).split(" ")[0] ?? "");
    }
  });

  /* session shutdown — finalize session record */

  pi.on("session_shutdown", (_, c: ExtensionContext) => {
    if (!session) return;
    const now = Date.now();

    // If agent is mid-run when pi exits, drop the orphaned input (incomplete data)
    currentInput = null;

    // Compute session cost as sum of per-input costs (re-uses same formula).
    // Fallback: estimate from final token count if no inputs were recorded.
    const lastModel = session.models.at(-1);
    let sessionCost = 0;
    if (lastModel && c.model) {
      const avgRate = (c.model.cost.input + c.model.cost.output) / 2;
      sessionCost   = (session.tokens / 1_000_000) * avgRate;
    }

    finalizeSession(
      session.id, now, session.turns, session.tokens, sessionCost,
      session.tools, session.commands, session.skills, session.models,
    );
    session = null;
  });

  /* /stat command */

  pi.registerCommand("stat", {
    description: "Show usage statistics dashboard (enter to open in browser)",
    handler: async (_, c: ExtensionContext) => {
      const { start, end } = weekRange();

      const [overall, weekly, tools, models, projects, daily, recent] = [
        getOverallStats(),
        getWeeklyStats(start, end),
        getTopToolsByInputs(start, STATS_CONFIG.topToolsLimit),
        getTopModelsByInputs(STATS_CONFIG.topModelsLimit),
        getTopProjects(STATS_CONFIG.topProjectsLimit),
        getDailyStats(STATS_CONFIG.tokenGraphDays),
        getRecentSessions(STATS_CONFIG.recentSessionsLimit),
      ];

      // Build HTML once so Enter can open it
      const htmlContent = buildHtmlDashboard(
        overall, weekly, tools, models, projects, daily, recent, start, end,
      );

      await c.ui.custom((_, __, ___, done) => {
        let cachedWidth: number | undefined;
        let cachedLines: string[] | undefined;

        return {
          render(width: number): string[] {
            if (cachedLines && cachedWidth === width) return cachedLines;
            cachedWidth = width;
            cachedLines = renderStats(
              overall, weekly, tools, models, projects, daily, recent, width, start,
            );
            return cachedLines;
          },
          invalidate() {
            cachedLines = undefined;
          },
          handleInput(data: string) {
            if (matchesKey(data, "escape") || data === "q") {
              done(undefined);
            } else if (matchesKey(data, "enter")) {
              // Write HTML to temp file and open in default browser
              const htmlPath = join(tmpdir(), "pi-stats.html");
              try {
                writeFileSync(htmlPath, htmlContent, "utf8");
                execSync(`open "${htmlPath}"`, { stdio: "ignore" });
              } catch {
                // silently ignore open errors
              }
              done(undefined);
            }
          },
        };
      });
    },
  });
}
