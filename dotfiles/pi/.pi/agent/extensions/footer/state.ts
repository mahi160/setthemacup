import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface Totals {
  input: number;
  output: number;
  cost: number;
}

export interface FooterState {
  toolCounts: Map<string, number>;
  totals: Totals;
  cachedUsage: ReturnType<ExtensionContext["getContextUsage"]>;
  lastActivityAt: number;
  agentRunning: boolean;
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
    totals: { input: 0, output: 0, cost: 0 },
    cachedUsage: undefined,
    lastActivityAt: Date.now(),
    agentRunning: false,
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
  state.totals.input = 0;
  state.totals.output = 0;
  state.totals.cost = 0;
  state.cachedUsage = undefined;
  state.lastActivityAt = Date.now();
  state.agentRunning = false;
  state.plannotatorPhase = "idle";
  state.lastEntryCount = 0;
}

export function requestRender(state: FooterState): void {
  state.widgetTui?.requestRender();
  state.footerTui?.requestRender();
}
