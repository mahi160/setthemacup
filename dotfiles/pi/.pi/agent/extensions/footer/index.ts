import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createState, resetState, requestRender } from "./state";
import { createTopWidget, createFooter } from "./render";
import { resetGitCache } from "./git";

export default function (pi: ExtensionAPI): void {
  const state = createState();

  function syncPlannotatorPhase(ctx: ExtensionContext): void {
    const entries = ctx.sessionManager.getEntries() as Array<{
      type: string;
      customType?: string;
      data?: { phase?: string };
    }>;

    // Skip scanning if no new entries — avoids filter/pop allocation per poll
    if (entries.length === state.lastEntryCount) return;
    state.lastEntryCount = entries.length;

    // Backwards scan for latest plannotator entry — single pass, zero allocations
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.type === "custom" && e.customType === "plannotator" && e.data?.phase) {
        state.plannotatorPhase = e.data.phase as
          | "idle"
          | "planning"
          | "executing";
        return;
      }
    }
  }

  pi.on("session_start", (_, ctx) => {
    state.savedCtx = ctx;
    resetState(state);
    resetGitCache();
    state.plannotatorPhase = "executing"; // Default to build

    clearInterval(state.idleTimer);
    // 60s — only needed to tick session elapsed time display once per minute
    state.idleTimer = setInterval(() => {
      if (!state.agentRunning) {
        if (state.savedCtx) syncPlannotatorPhase(state.savedCtx);
        requestRender(state);
      }
    }, 5_000);

    if (ctx.hasUI) {
      ctx.ui.setWidget("status-top", createTopWidget(ctx, pi, state), {
        placement: "aboveEditor",
      });
      ctx.ui.setFooter(createFooter(ctx, state));
    }
  });

  pi.on("agent_start", () => {
    state.agentRunning = true;
  });

  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    const u = (event.message as AssistantMessage).usage;
    if (!u) return;
    state.sessionCost += u.cost?.total ?? 0;
    state.sessionHasData = true;
  });

  pi.on("agent_end", (_, ctx) => {
    state.agentRunning = false;
    syncPlannotatorPhase(ctx);
    requestRender(state);
  });

  pi.on("turn_end", (_, ctx) => {
    state.cachedUsage = undefined;
    syncPlannotatorPhase(ctx);
    requestRender(state);
  });

  pi.on("model_select", () => requestRender(state));
  pi.on("thinking_level_select", () => requestRender(state));

  pi.on("tool_execution_start", (event) => {
    state.toolCounts.set(
      event.toolName,
      (state.toolCounts.get(event.toolName) ?? 0) + 1,
    );
    // Cap to 20 tools to prevent memory growth
    if (state.toolCounts.size > 20) {
      const firstKey = state.toolCounts.keys().next().value;
      state.toolCounts.delete(firstKey);
    }
    requestRender(state);
  });

  pi.on("session_shutdown", () => {
    clearInterval(state.idleTimer);
    state.idleTimer = undefined;
    state.savedCtx = undefined;
    state.widgetTui = undefined;
    state.footerTui = undefined;
    state.footerDispose?.();
    state.footerDispose = undefined;
  });
}
