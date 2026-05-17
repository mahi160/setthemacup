/**
 * stats/index.ts — Pi usage stats extension (v3).
 *
 * Tracks per-session, per-input, compaction, and error data.
 *
 * Commands:
 *   /stat  → opens HTML dashboard in browser
 *   /cost  → quick today's cost notification
 *
 * Features:
 *   - Auto-compact reminder at >80% context
 *   - Session auto-naming (git branch or first prompt)
 *   - Compaction + error tracking
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawn } from "node:child_process";

import {
  closeDb,
  createInputRecord,
  finalizeInputRecord,
  finalizeSession,
  getCacheRatio,
  getCompactionSummary,
  getCompactions,
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
  getToollessInputCount,
  getTopModelsByInputs,
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
  topModelsLimit: 6,
  topProjectsLimit: 8,
  chartDays: 30,
  recentSessionsLimit: 6,
  compactWarningPct: 80,
  compactWarningCooldownMs: 300_000,
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
  named: boolean;
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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function weekRange(): { start: number; end: number } {
  const end = Date.now();
  return { start: end - STATS_CONFIG.weekDays * 86_400_000, end };
}

function parseInputPrefix(text: string): { skills: Map<string, number>; commands: Map<string, number> } {
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

let _gitBranchAt = 0, _gitBranchVal = "";
function gitBranch(): string {
  const now = Date.now();
  if (now - _gitBranchAt < 5_000) return _gitBranchVal;
  _gitBranchAt = now;
  try {
    _gitBranchVal = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8", timeout: 3_000, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { _gitBranchVal = ""; }
  return _gitBranchVal;
}

function resolveSessionId(ctx: ExtensionContext): string {
  const sm = ctx.sessionManager as unknown as { getSessionId?(): string };
  if (typeof sm.getSessionId === "function") return sm.getSessionId();
  const file = ctx.sessionManager.getSessionFile();
  return file ? basename(file, ".jsonl") : `ephemeral_${Date.now()}`;
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  let session: SessionState | null = null;
  let currentInput: InputState | null = null;
  let lastCompactWarning = 0;

  // ── Session lifecycle ───────────────────────────────────────────────────

  pi.on("session_start", (_, ctx: ExtensionContext) => {
    const id = resolveSessionId(ctx);
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
        ? [{ provider: ctx.model.provider, modelId: ctx.model.id, selectedAt: now }]
        : [],
      named: false,
    };
    upsertSession(id, now, ctx.cwd ?? "");

    // Auto-name session from git branch
    const branch = gitBranch();
    if (branch && branch !== "main" && branch !== "master" && branch !== "HEAD") {
      pi.setSessionName(branch);
      session.named = true;
    }
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

    const { skills, commands } = parseInputPrefix(event.prompt ?? "");
    const model = ctx.model;

    currentInput = {
      id: randomUUID(),
      sessionId: session.id,
      startedAt: Date.now(),
      provider: model?.provider ?? "unknown",
      modelId: model?.id ?? "unknown",
      branch: gitBranch(),
      tools: new Map(),
      commands,
      skills,
      totalTokens: 0,
      tokensInput: 0,
      tokensOutput: 0,
      tokensCacheRead: 0,
      tokensCacheWrite: 0,
      costAccumulated: 0,
    };

    createInputRecord({
      id: currentInput.id,
      sessionId: currentInput.sessionId,
      startedAt: currentInput.startedAt,
      provider: currentInput.provider,
      modelId: currentInput.modelId,
      branch: currentInput.branch,
    });

    // Auto-name from first prompt if not already named
    if (!session.named && event.prompt) {
      const name = event.prompt.trim().slice(0, 60).replace(/\n/g, " ").trim();
      if (name) {
        pi.setSessionName(name);
        session.named = true;
      }
    }
  });

  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant" || !currentInput) return;
    const msg = event.message as AssistantMessage;
    if (!msg.usage) return;

    currentInput.totalTokens = msg.usage.totalTokens ?? 0;
    currentInput.costAccumulated += msg.usage.cost.total ?? 0;
    currentInput.tokensInput += msg.usage.input ?? 0;
    currentInput.tokensOutput += msg.usage.output ?? 0;
    currentInput.tokensCacheRead += msg.usage.cacheRead ?? 0;
    currentInput.tokensCacheWrite += msg.usage.cacheWrite ?? 0;
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

    // Auto-compact reminder
    if (usage?.percent && usage.percent > STATS_CONFIG.compactWarningPct) {
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

    // Track errors
    for (const msg of event.messages as AssistantMessage[]) {
      if (msg.role === "assistant" && (msg.stopReason === "error" || msg.stopReason === "aborted")) {
        recordError(
          session.id,
          msg.stopReason,
          currentInput.modelId,
          msg.errorMessage ?? "unknown",
        );
      }
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

  // ── Command + skill tracking ────────────────────────────────────────────

  pi.on("input", (event) => {
    if (!session) return;
    const text = event.text.trim();
    if (text.startsWith("/skill:")) {
      inc(session.skills, text.slice(7).split(" ")[0] ?? "");
    } else if (text.startsWith("/")) {
      inc(session.commands, text.slice(1).split(" ")[0] ?? "");
    }
  });

  // ── Session shutdown ────────────────────────────────────────────────────

  pi.on("session_shutdown", () => {
    if (!session) return;
    currentInput = null;

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
        tokenBreakdown: getTokenBreakdown(),
        cacheRatio: getCacheRatio(),
        compactions: getCompactions(),
        compactionSummary: getCompactionSummary(),
        errorSummary: getErrorSummary(),
        errors: getRecentErrors(),
        streak: getStreak(),
        toolless: getToollessInputCount(start),
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
