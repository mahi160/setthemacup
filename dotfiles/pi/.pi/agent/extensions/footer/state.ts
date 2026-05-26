import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface FooterState {
  toolCounts: Map<string, number>;
  cachedUsage: ReturnType<ExtensionContext["getContextUsage"]>;
  agentRunning: boolean;
  sessionStartedAt: number;  // wall time when session began — for elapsed display
  sessionCost: number;       // cumulative cost across all runs in this session
  sessionHasData: boolean;   // true after first assistant message — unlocks cost display
  idleTimer: ReturnType<typeof setInterval> | undefined;
  savedCtx: ExtensionContext | undefined;
  plannotatorPhase: "idle" | "planning" | "executing";
  branch: string;
  lastEntryCount: number;
  widgetTui: { requestRender(): void } | undefined;
  footerTui: { requestRender(): void } | undefined;
  footerDispose: (() => void) | undefined;
}

export function createState(): FooterState {
  return {
    toolCounts: new Map<string, number>(),
    cachedUsage: undefined,
    agentRunning: false,
    sessionStartedAt: Date.now(),
    sessionCost: 0,
    sessionHasData: false,
    idleTimer: undefined,
    savedCtx: undefined,
    plannotatorPhase: "idle",
    branch: "",
    lastEntryCount: 0,
    widgetTui: undefined,
    footerTui: undefined,
    footerDispose: undefined,
  };
}

export function resetState(state: FooterState): void {
  state.toolCounts.clear();
  state.cachedUsage = undefined;
  state.agentRunning = false;
  state.plannotatorPhase = "idle";
  state.lastEntryCount = 0;
  state.sessionStartedAt = Date.now(); // reset clock for new session
  state.sessionCost = 0;               // reset cost for new session
  state.sessionHasData = false;
}

export function requestRender(state: FooterState): void {
  state.widgetTui?.requestRender();
  state.footerTui?.requestRender();
}
