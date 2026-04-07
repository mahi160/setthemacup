import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { randomUUID } from "node:crypto";
import {
  finalizeSession, getDailyStats, getOverallStats,
  getRecentSessions, getTopModels, getTopTools, upsertSession,
} from "./db.js";
import { renderStats } from "./render.js";

interface SessionState {
  id:       string;
  startedAt: number;
  turns:    number;
  tokens:   number;
  cost:     number;
  tools:    Map<string, number>;
  commands: Map<string, number>;
  skills:   Map<string, number>;
  models:   Array<{ provider: string; modelId: string; selectedAt: number }>;
}

function freshState(id: string, startedAt: number): SessionState {
  return { id, startedAt, turns: 0, tokens: 0, cost: 0,
    tools: new Map(), commands: new Map(), skills: new Map(), models: [] };
}

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export default function (pi: ExtensionAPI) {
  let state: SessionState | null = null;
  let ctx: ExtensionContext | null = null;

  pi.on("session_start", (_, c: ExtensionContext) => {
    ctx = c;
    const id = c.sessionManager.getSessionFile() ?? randomUUID();
    const now = Date.now();
    state = freshState(id, now);
    upsertSession(id, now, c.cwd ?? "");

    // Record initial model
    if (c.model) {
      state.models.push({
        provider:  c.model.provider,
        modelId:   c.model.id,
        selectedAt: now,
      });
    }
  });

  pi.on("model_select", (event) => {
    if (!state) return;
    state.models.push({
      provider:  event.model.provider,
      modelId:   event.model.id,
      selectedAt: Date.now(),
    });
  });

  pi.on("tool_execution_start", (event) => {
    if (!state) return;
    inc(state.tools, event.toolName);
  });

  pi.on("input", (event) => {
    if (!state) return;
    const text = event.text.trim();
    if (text.startsWith("/skill:")) {
      inc(state.skills, text.slice(7).split(" ")[0] ?? "");
    } else if (text.startsWith("/")) {
      inc(state.commands, text.slice(1).split(" ")[0] ?? "");
    }
  });

  pi.on("turn_end", (_, c: ExtensionContext) => {
    if (!state) return;
    state.turns++;
    const usage = c.getContextUsage();
    if (usage?.tokens) state.tokens = usage.tokens;
  });

  pi.on("session_shutdown", (_, c: ExtensionContext) => {
    if (!state) return;
    const now = Date.now();

    // Estimate cost from last known model
    const lastModel = state.models.at(-1);
    if (lastModel && c.model) {
      state.cost = state.tokens * (c.model.cost.input + c.model.cost.output) / 2;
    }

    finalizeSession(
      state.id, now, state.turns, state.tokens, state.cost,
      state.tools, state.commands, state.skills, state.models,
    );
    state = null;
  });

  pi.registerCommand("stat", {
    description: "Show usage statistics",
    handler: async (_, c: ExtensionContext) => {
      const [overall, tools, models, daily, recent] = [
        getOverallStats(),
        getTopTools(),
        getTopModels(),
        getDailyStats(),
        getRecentSessions(),
      ];

      await c.ui.custom((_, __, ___, done) => {
        let cachedWidth: number | undefined;
        let cachedLines: string[] | undefined;

        return {
          render(width: number): string[] {
            if (cachedLines && cachedWidth === width) return cachedLines;
            cachedWidth = width;
            cachedLines = renderStats(overall, tools, models, daily, recent, width);
            return cachedLines;
          },
          invalidate() {
            cachedLines = undefined;
          },
          handleInput(data: string) {
            if (data === "\x1b" || data === "q") done(undefined);
          },
        };
      });
    },
  });
}
