/**
 * stats/index.ts — Pi usage stats extension.
 *
 * Tracks per-session, per-input, compaction, and error data in SQLite
 * (~/.pi/agent/stats.db, node:sqlite — no npm install needed).
 *
 * Commands:
 *   /stat  → opens HTML dashboard in browser
 *   /cost  → quick today's cost notification
 *
 * Features:
 *   - Auto-compact reminder / auto-compact at high context usage
 *   - Skill usage tracked by watching for `read` calls into a skill's SKILL.md
 *     (native skills are loaded via the read tool — see pi's skills.js)
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, dirname } from "node:path";
import { spawn } from "node:child_process";

import { getGitBranch, seedGitBranch } from "../shared/git.js";

import {
  closeDb,
  createInputRecord,
  finalizeInputRecord,
  finalizeSession,
  getCacheRatio,
  getCompactionSummary,
  getDailyCosts,
  getDailyStats,
  getDurationHistogram,
  getErrorSummary,
  getModelEfficiency,
  getOverallStats,
  getRecentErrors,
  getRecentSessions,
  getStreak,
  getTodayStats,
  getTokenBreakdown,
  getTokenWaste,
  getTopProjects,
  getTopToolsByInputs,
  getWeeklyStats,
  recordCompaction,
  recordError,
  upsertSession,
} from "./db.js";
import { buildHtml } from "./html.js";
import { fmtTokens, fmtCost } from "./format.js";

// ── Config ────────────────────────────────────────────────────────────────────

const STATS_CONFIG = {
  weekDays: 7,
  topToolsLimit: 10,
  topProjectsLimit: 8,
  chartDays: 30,
  recentSessionsLimit: 6,
  compactWarningPct: 80,
  compactWarningCooldownMs: 300_000,
  compactAutoPct: 95,
};

// ── Types ─────────────────────────────────────────────────────────────────────

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
  provider: string;
  modelId: string;
  branch: string;
  tools: Map<string, number>;
  commands: Map<string, number>;
  skills: Map<string, number>;
  totalTokens: number;
  tokensInput: number;
  tokensOutput: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
  costAccumulated: number;
  requestCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function weekRange(): { start: number; end: number } {
  const end = Date.now();
  return { start: end - STATS_CONFIG.weekDays * 86_400_000, end };
}

function parseInputPrefix(text: string): { commands: Map<string, number> } {
  const commands = new Map<string, number>();
  const trimmed = text.trim();
  if (trimmed.startsWith("/")) {
    const name = trimmed.slice(1).split(" ")[0] ?? "";
    if (name) inc(commands, name);
  }
  return { commands };
}

// Native skills are loaded by the model calling `read` on a SKILL.md file
// (see pi core's formatSkillsForPrompt: "Use the read tool to load a skill's
// file"). No separate skill-invocation event exists, so this is the signal.
function skillNameFromReadPath(path: unknown): string | undefined {
  if (typeof path !== "string" || !path.endsWith("/SKILL.md")) return undefined;
  return basename(dirname(path));
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  let session: SessionState | null = null;
  let currentInput: InputState | null = null;
  let lastCompactWarning = 0;
  let compacting = false;
  let pendingSlash: string | null = null;

  // ── Session lifecycle ───────────────────────────────────────────────────

  pi.on("session_start", (_, ctx: ExtensionContext) => {
    const id = ctx.sessionManager.getSessionId();
    const now = Date.now();
    seedGitBranch(ctx.cwd);
    session = {
      id,
      startedAt: now,
      turns: 0,
      tokens: 0,
      tools: new Map(),
      commands: new Map(),
      skills: new Map(),
      models: ctx.model
        ? [{ provider: ctx.model.provider, modelId: ctx.model.id, selectedAt: now }]
        : [],
    };
    upsertSession(id, now, ctx.cwd ?? "");
    lastCompactWarning = 0;
    compacting = false;
  });

  pi.on("model_select", (event) => {
    session?.models.push({
      provider: event.model.provider,
      modelId: event.model.id,
      selectedAt: Date.now(),
    });
  });

  // ── Per-input lifecycle ─────────────────────────────────────────────────

  pi.on("before_agent_start", (event, ctx: ExtensionContext) => {
    if (!session) return;
    currentInput = null;

    const rawText = pendingSlash ?? event.prompt ?? "";
    pendingSlash = null;
    const { commands } = parseInputPrefix(rawText);
    const model = ctx.model;

    currentInput = {
      id: randomUUID(),
      sessionId: session.id,
      startedAt: Date.now(),
      provider: model?.provider ?? "unknown",
      modelId: model?.id ?? "unknown",
      branch: getGitBranch(ctx.cwd),
      tools: new Map(),
      commands,
      skills: new Map(),
      totalTokens: 0,
      tokensInput: 0,
      tokensOutput: 0,
      tokensCacheRead: 0,
      tokensCacheWrite: 0,
      costAccumulated: 0,
      requestCount: 0,
    };

    createInputRecord({
      id: currentInput.id,
      sessionId: currentInput.sessionId,
      startedAt: currentInput.startedAt,
      provider: currentInput.provider,
      modelId: currentInput.modelId,
      branch: currentInput.branch,
    });
  });

  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant" || !currentInput) return;
    const msg = event.message as AssistantMessage;
    if (!msg.usage) return;

    currentInput.totalTokens += msg.usage.totalTokens ?? 0;
    currentInput.costAccumulated += msg.usage.cost.total ?? 0;
    currentInput.tokensInput += msg.usage.input ?? 0;
    currentInput.tokensOutput += msg.usage.output ?? 0;
    currentInput.tokensCacheRead += msg.usage.cacheRead ?? 0;
    currentInput.tokensCacheWrite += msg.usage.cacheWrite ?? 0;
    currentInput.requestCount++;
  });

  pi.on("tool_execution_start", (event) => {
    if (session) inc(session.tools, event.toolName);
    if (currentInput) inc(currentInput.tools, event.toolName);

    if (event.toolName === "read") {
      const skill = skillNameFromReadPath((event.args as { path?: unknown })?.path);
      if (skill) {
        if (session) inc(session.skills, skill);
        if (currentInput) inc(currentInput.skills, skill);
      }
    }
  });

  pi.on("turn_end", (_, ctx: ExtensionContext) => {
    if (!session) return;
    session.turns++;
    const usage = ctx.getContextUsage();
    if (usage?.tokens) session.tokens = usage.tokens;

    // Critical — compact now, don't wait for the user to notice.
    if (usage?.percent && usage.percent > STATS_CONFIG.compactAutoPct && !compacting) {
      compacting = true;
      ctx.ui.notify(`Context at ${Math.round(usage.percent)}% — auto-compacting`, "warning");
      ctx.compact({
        onComplete: () => {
          compacting = false;
          ctx.ui.notify("Auto-compact done", "info");
        },
        onError: (error) => {
          compacting = false;
          ctx.ui.notify(`Auto-compact failed: ${error.message}`, "error");
        },
      });
    } else if (usage?.percent && usage.percent > STATS_CONFIG.compactWarningPct) {
      // Soft warning — leave the call to the user below the critical threshold.
      const now = Date.now();
      if (now - lastCompactWarning > STATS_CONFIG.compactWarningCooldownMs) {
        lastCompactWarning = now;
        ctx.ui.notify(`Context at ${Math.round(usage.percent)}% — consider /compact`, "warning");
      }
    }
  });

  pi.on("agent_end", (event) => {
    if (!currentInput || !session) return;
    const endedAt = Date.now();

    const messages = event.messages as AssistantMessage[];
    const lastAssistant = messages.slice().reverse().find((m) => m.role === "assistant");
    const hadError = !!(lastAssistant && (lastAssistant.stopReason === "error" || lastAssistant.stopReason === "aborted"));
    if (hadError) {
      recordError(
        session.id,
        lastAssistant!.stopReason,
        currentInput.modelId,
        lastAssistant!.errorMessage ?? "unknown",
      );
    }

    try {
      finalizeInputRecord(
        currentInput.id,
        endedAt,
        endedAt - currentInput.startedAt,
        currentInput.totalTokens,
        currentInput.tools,
        currentInput.commands,
        currentInput.skills,
        currentInput.costAccumulated,
        currentInput.tokensInput,
        currentInput.tokensOutput,
        currentInput.tokensCacheRead,
        currentInput.tokensCacheWrite,
        currentInput.requestCount,
        hadError,
      );
    } catch (e) {
      console.error("[pi-stats] finalizeInputRecord failed:", e);
    }
    currentInput = null;
  });

  // ── Compaction tracking ─────────────────────────────────────────────────

  pi.on("session_compact", (event) => {
    if (!session) return;
    const entry = event.compactionEntry;
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      recordCompaction(
        session.id,
        Number(e.tokensBefore ?? 0),
        Number(e.tokensAfter ?? 0),
      );
    }
  });

  // ── Command tracking ─────────────────────────────────────────────────────

  pi.on("input", (event) => {
    const text = event.text.trim();
    if (text.startsWith("/")) pendingSlash = text;
    if (!session) return;
    if (text.startsWith("/")) {
      inc(session.commands, text.slice(1).split(" ")[0] ?? "");
    }
  });

  // ── Session shutdown ────────────────────────────────────────────────────

  pi.on("session_shutdown", () => {
    if (!session) return;
    currentInput = null;
    pendingSlash = null;

    try {
      finalizeSession(
        session.id,
        Date.now(),
        session.turns,
        session.tokens,
        session.tools,
        session.commands,
        session.skills,
        session.models,
      );
    } catch (e) {
      console.error("[pi-stats] finalizeSession failed:", e);
    }
    session = null;
    closeDb();
  });

  // ── /stat command ───────────────────────────────────────────────────────

  pi.registerCommand("stat", {
    description: "Open usage stats dashboard in browser",
    handler: async (_, ctx: ExtensionContext) => {
      const { start, end } = weekRange();
      const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

      const data = {
        generatedAt: new Date().toLocaleString(),
        today: getTodayStats(),
        week: getWeeklyStats(start, end),
        overall: getOverallStats(),
        tools: getTopToolsByInputs(start, STATS_CONFIG.topToolsLimit),
        models: getModelEfficiency(),
        projects: getTopProjects(STATS_CONFIG.topProjectsLimit),
        daily: getDailyStats(STATS_CONFIG.chartDays),
        dailyCost: getDailyCosts(STATS_CONFIG.chartDays),
        recent: getRecentSessions(STATS_CONFIG.recentSessionsLimit),
        histogram: getDurationHistogram(),
        waste: getTokenWaste(),
        tokenBreakdown: getTokenBreakdown(startOfDay),
        cacheRatio: getCacheRatio(startOfDay),
        weekCacheRatio: getCacheRatio(start),
        compactionSummary: getCompactionSummary(),
        errorSummary: getErrorSummary(),
        errors: getRecentErrors(),
        streak: getStreak(),
      };

      const html = buildHtml(data);
      const outPath = join(tmpdir(), "pi-stats.html");
      writeFileSync(outPath, html, "utf8");
      const opener = process.platform === "darwin" ? "open" : "xdg-open";
      spawn(opener, [outPath], { detached: true, stdio: "ignore" }).unref();
      ctx.ui.notify(`Stats → ${outPath}`, "success");
    },
  });

  // ── /cost command ───────────────────────────────────────────────────────

  pi.registerCommand("cost", {
    description: "Show today's cost summary",
    handler: async (_, ctx: ExtensionContext) => {
      const today = getTodayStats();
      const streak = getStreak();
      ctx.ui.notify(
        `Today: ${fmtCost(today.cost)} · ${today.inputs} inputs · ${fmtTokens(today.tokens)} tok · 🔥 ${streak}d`,
        "info",
      );
    },
  });
}
