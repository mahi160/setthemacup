import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface FooterState {
  toolCounts: Map<string, number>;
  cachedUsage: ReturnType<ExtensionContext["getContextUsage"]>;
  sessionCost: number; // cumulative cost across all runs in this session
  sessionHasData: boolean; // true after first assistant message — unlocks cost display
  sessionRequests: number; // count of assistant round-trips (LLM requests) this session
  lastTurnInput: number;
  lastTurnOutput: number;
  lastTurnCacheRead: number;
  lastTurnCost: number;
  savedCtx: ExtensionContext | undefined;
  plannotatorPhase: "idle" | "planning" | "executing";
  lastEntryCount: number; // scan cursor for plannotator phase entries
  branch: string; // mirrored from footerData via the footer's onBranchChange (only setFooter gets footerData)
  lastDirty: string; // last known git dirty string, for change-only re-render
  dirtyTimer: ReturnType<typeof setInterval> | undefined;
  widgetTui: { requestRender(): void } | undefined;
  widgetTokenTui: { requestRender(): void } | undefined;
  footerTui: { requestRender(): void } | undefined;
  footerDispose: (() => void) | undefined;
}

export function createState(): FooterState {
  return {
    toolCounts: new Map<string, number>(),
    cachedUsage: undefined,
    sessionCost: 0,
    sessionHasData: false,
    sessionRequests: 0,
    lastTurnInput: 0,
    lastTurnOutput: 0,
    lastTurnCacheRead: 0,
    lastTurnCost: 0,
    savedCtx: undefined,
    plannotatorPhase: "idle",
    lastEntryCount: 0,
    branch: "",
    lastDirty: "",
    dirtyTimer: undefined,
    widgetTui: undefined,
    widgetTokenTui: undefined,
    footerTui: undefined,
    footerDispose: undefined,
  };
}

export function resetState(state: FooterState): void {
  state.toolCounts.clear();
  state.cachedUsage = undefined;
  state.plannotatorPhase = "idle";
  state.lastEntryCount = 0;
  state.lastDirty = "";
  state.sessionCost = 0;
  state.sessionHasData = false;
  state.sessionRequests = 0;
}

export function requestRender(state: FooterState): void {
  state.widgetTui?.requestRender();
  state.widgetTokenTui?.requestRender();
  state.footerTui?.requestRender();
}
