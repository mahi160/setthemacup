import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createState, resetState, requestRender } from "./state";
import { createTopWidget, createTokenWidget, createFooter } from "./render";
import { getGitDirty, resetGitCache } from "../shared/git";

// Passive git-dirty refresh — no full re-render, just keeps shared/git's
// cache warm so render() reads are cheap and reasonably fresh even when no
// other event has fired in a while (e.g. user is idle mid-edit).
const DIRTY_POLL_MS = 3_000;

export default function (pi: ExtensionAPI): void {
  const state = createState();

  // Best-effort: ctx can be invalidated mid-flight if the session is
  // disposed (e.g. process exit racing a late `agent_settled`/`turn_end`
  // in short-lived RPC/print runs). Footer state is cosmetic — swallow.
  function safe(fn: () => void): void {
    try {
      fn();
    } catch {
      // ignore stale-ctx or teardown races
    }
  }

  pi.on("session_start", (_, ctx) => {
    state.savedCtx = ctx;
    resetState(state);
    resetGitCache();

    clearInterval(state.dirtyTimer);
    state.dirtyTimer = setInterval(() => {
      const dirty = getGitDirty(ctx.cwd ?? "");
      if (dirty !== state.lastDirty) {
        state.lastDirty = dirty;
        state.widgetTui?.requestRender();
      }
    }, DIRTY_POLL_MS);

    if (ctx.hasUI) {
      ctx.ui.setWidget("token-stats", createTokenWidget(state), {
        placement: "aboveEditor",
      });
      ctx.ui.setWidget("status-top", createTopWidget(ctx, pi, state), {
        placement: "aboveEditor",
      });
      ctx.ui.setFooter(createFooter(ctx, state));
    }
  });

  pi.on("agent_start", () => {
    state.lastTurnInput = 0;
    state.lastTurnOutput = 0;
    state.lastTurnCacheRead = 0;
    state.lastTurnCost = 0;
  });

  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    const u = (event.message as AssistantMessage).usage;
    if (!u) return;
    state.sessionCost += u.cost?.total ?? 0;
    state.sessionHasData = true;
    state.sessionRequests++;
    state.lastTurnInput += u.input ?? 0;
    state.lastTurnOutput += u.output ?? 0;
    state.lastTurnCacheRead += u.cacheRead ?? 0;
    state.lastTurnCost += u.cost?.total ?? 0;
  });

  pi.on("agent_settled", () => {
    safe(() => requestRender(state));
  });

  pi.on("turn_end", () => {
    safe(() => {
      state.cachedUsage = undefined;
      requestRender(state);
    });
  });

  pi.on("model_select", () => requestRender(state));
  pi.on("thinking_level_select", () => requestRender(state));
  pi.on("session_info_changed", () => requestRender(state));

  pi.on("tool_execution_start", (event) => {
    state.toolCounts.set(
      event.toolName,
      (state.toolCounts.get(event.toolName) ?? 0) + 1,
    );
    requestRender(state);
  });

  pi.on("session_shutdown", () => {
    clearInterval(state.dirtyTimer);
    state.dirtyTimer = undefined;
    state.savedCtx = undefined;
    state.widgetTui = undefined;
    state.widgetTokenTui = undefined;
    state.footerTui = undefined;
    state.footerDispose?.();
    state.footerDispose = undefined;
  });
}
